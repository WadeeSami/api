import { NowPlayingService } from "../../services/nowPlaying.js";
import { PUBSUB_CHANNELS } from "../../utils/constant.js";
import type { Resolvers } from "../graphql.gen.js";

const resolvers: Resolvers = {
  Query: {
    async nowPlaying(parent, { id }) {
      const currentTrack = await NowPlayingService.findCurrentItemById(id);
      return { id, currentTrack };
    },
    async nowPlayingReactions(parent, { id }) {
      return NowPlayingService.getAllReactions(id);
    },
  },
  Mutation: {
    async nowPlayingReact(parent, { id, reaction }, context) {
      await NowPlayingService.reactNowPlaying(context, id, reaction);
      return true;
    },
    async nowPlayingSkip(parent, { id, isBackward }, context) {
      return NowPlayingService[isBackward ? "skipBackward" : "skipForward"](
        context,
        id
      );
    },
    async nowPlayingPlayUid(parent, { id, uid }, context) {
      return NowPlayingService.playUid(context, id, uid);
    },
  },
  Subscription: {
    nowPlayingUpdated: {
      subscribe(parent, { id }, { pubsub }) {
        return pubsub.on(
          PUBSUB_CHANNELS.nowPlayingUpdated,
          (payload) => payload.nowPlayingUpdated.id === id
        );
      },
    },
    nowPlayingReactionsUpdated: {
      subscribe(parent, { id }, { pubsub }) {
        return pubsub.on(
          PUBSUB_CHANNELS.nowPlayingReactionsUpdated,
          (payload) => payload.id === id
        );
      },
    },
  },
};

export default resolvers;
