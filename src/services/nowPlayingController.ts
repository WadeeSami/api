import pino from "pino";
import { pubsub } from "../data/pubsub.js";
import { redis } from "../data/redis.js";
import type {
  NowPlayingState,
  NowPlayingStateRedisValue,
} from "../data/types.js";
import type { NowPlayingQueueItem } from "../graphql/graphql.gen.js";
import { pinoOpts } from "../logger/options.js";
import { PUBSUB_CHANNELS, REDIS_KEY } from "../utils/constant.js";
import { NowPlayingService } from "./nowPlaying.js";
import { QueueService } from "./queue.js";
import { SessionService } from "./session.js";
import { TrackService } from "./track.js";
import { UserService } from "./user.js";

const logger = pino({
  ...pinoOpts,
  name: "service/nowPlayingController",
});
export class NowPlayingController {
  static async getFormattedNowPlayingState(
    id: string
  ): Promise<NowPlayingState> {
    const nowPlayingState = (await redis.hgetall(
      REDIS_KEY.nowPlayingState(id)
    )) as NowPlayingStateRedisValue;

    return {
      playingIndex: Number(nowPlayingState.playingIndex),
      queuePlayingUid: nowPlayingState.queuePlayingUid,
      playedAt: new Date(nowPlayingState.playedAt),
      endedAt: new Date(nowPlayingState.endedAt),
    };
  }

  static async setNowPlayingState(id: string, state: NowPlayingState) {
    logger.debug({ id, state }, "setNowPlayingState");

    const value: Partial<NowPlayingStateRedisValue> = {};
    value.playingIndex = state.playingIndex.toString();
    value.queuePlayingUid = state.queuePlayingUid;
    value.playedAt = state.playedAt.toJSON();
    value.endedAt = state.endedAt.toJSON();

    const pipeline = redis.pipeline();
    // Set the value to nowPlayingState
    pipeline.hset(REDIS_KEY.nowPlayingState(id), value);
    // Schedule the next skip forward to zset

    pubsub.pub.publish(
      PUBSUB_CHANNELS.worker,
      `${id}|${state.endedAt.getTime()}`
    );

    await pipeline.exec();
  }

  static async setNewPlayingIndexOrUid(
    id: string,
    indexOrUid: number | string
  ) {
    logger.debug({ id, indexOrUid }, "setNewPlayingIndexOrUid");
    let uid: string;
    let index: number;
    if (typeof indexOrUid === "string") {
      uid = indexOrUid;
      const findIndex = await QueueService.getIndexByUid(id, uid);
      if (!findIndex)
        throw new Error(`Queue index is null for id = ${id}, uid = ${uid}`);
      index = findIndex;
    } else {
      index = indexOrUid;
      const findUid = await QueueService.getUidAtIndex(id, index);
      if (!findUid)
        throw new Error(`Queue uid is null for id = ${id}, index = ${index}`);
      uid = findUid;
    }

    const queueItem = await QueueService.findQueueItemData(id, uid);
    if (!queueItem)
      throw new Error(`QueueItem is null for id = ${id}, uid = ${uid}`);

    const track = await TrackService.findTrack(
      {
        loaders: {
          session: SessionService.createLoader(),
          track: TrackService.createLoader(),
          user: UserService.createLoader(),
        },
        auth: null,
      },
      queueItem.trackId
    );
    if (!track) throw new Error(`Track is null for id = ${queueItem.trackId}`);

    const playedAt = new Date();
    const endedAt = new Date(playedAt.getTime() + track.duration);

    await NowPlayingController.setNowPlayingState(id, {
      playingIndex: index,
      queuePlayingUid: uid,
      playedAt,
      endedAt,
    });

    const currentTrack: NowPlayingQueueItem = {
      trackId: queueItem.trackId,
      uid,
      creatorId: queueItem.creatorId,
      playedAt,
      endedAt,
      index,
    };
    // Notify nowPlaying changes
    NowPlayingController.notifyUpdate(id, currentTrack);
  }

  static async skipForward(id: string) {
    logger.debug({ id }, "executeSkipForward");
    const [nowPlayingState, queueLength] = await Promise.all([
      NowPlayingController.getFormattedNowPlayingState(id),
      QueueService.getQueueLength(id),
    ]);

    // Either go back to first track if at end or go to the next
    const nextPlayingIndex =
      nowPlayingState.playingIndex >= queueLength - 1
        ? 0
        : nowPlayingState.playingIndex + 1;

    await NowPlayingController.setNewPlayingIndexOrUid(id, nextPlayingIndex);
  }

  static async skipBackward(id: string) {
    logger.debug({ id }, "executeSkipBackward");
    const nowPlayingState =
      await NowPlayingController.getFormattedNowPlayingState(id);

    const nextPlayingIndex = Math.max(nowPlayingState.playingIndex - 1, 0);

    await this.setNewPlayingIndexOrUid(id, nextPlayingIndex);
  }

  static async notifyUpdate(id: string, currentHint?: NowPlayingQueueItem) {
    const current =
      currentHint || (await NowPlayingService.findCurrentItemById(id));
    const next = await QueueService.findById(id, current.index + 1);
    pubsub.publish(PUBSUB_CHANNELS.nowPlayingUpdated, {
      nowPlayingUpdated: {
        id,
        current,
        next,
      },
    });
  }
}
