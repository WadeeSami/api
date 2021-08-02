import { AuthState } from "../../auth/types.js";
import { PUBSUB_CHANNELS } from "../../utils/constant.js";
import type { Resolvers } from "../graphql.gen.js";

const resolvers: Resolvers = {
  Query: {
    async queue(parent, { id }) {
      // FIXME: Check auth
      return { id, items: [] };
    },
  },
  Mutation: {
    async queueAdd(parent, { id, ...addArgs }, { auth, services }) {
      await services.Queue.assertStoryQueueActionable(auth, id);
      return services.Queue.executeQueueAction(auth as AuthState, id, {
        add: addArgs,
      });
    },
    async queueRemove(parent, { id, uids }, { auth, services }) {
      await services.Queue.assertStoryQueueActionable(auth, id);
      return services.Queue.executeQueueAction(auth as AuthState, id, {
        remove: uids,
      });
    },
    async queueReorder(parent, { id, ...reorderArgs }, { auth, services }) {
      await services.Queue.assertStoryQueueActionable(auth, id);
      return services.Queue.executeQueueAction(auth as AuthState, id, {
        reorder: reorderArgs,
      });
    },
    async queueToTop(parent, { id, ...toTopArgs }, { auth, services }) {
      await services.Queue.assertStoryQueueActionable(auth, id);
      return services.Queue.executeQueueAction(auth as AuthState, id, {
        toTop: toTopArgs,
      });
    },
  },
  Subscription: {
    queueUpdated: {
      subscribe(parent, { id }, { pubsub }) {
        // FIXME: This allows nonmember to subscribe
        return pubsub.on(
          PUBSUB_CHANNELS.queueUpdated,
          (payload) => payload.queueUpdated.id === id
        );
      },
    },
  },
  Queue: {
    async items({ id }, args, { services }) {
      return services.Queue.findById(id, 0, -1);
    },
  },
};

export default resolvers;
