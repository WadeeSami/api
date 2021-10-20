import { TrackService } from "../../services/track.js";
import type { Resolvers } from "../graphql.gen.js";

const resolvers: Resolvers = {
  Query: {
    playlist(parent, { id }, context) {
      return TrackService.findPlaylist(context, id);
    },
    myPlaylists(parent, args, context) {
      return TrackService.findMyPlaylist(context);
    },
    playlistTracks(parent, { id }, context) {
      return TrackService.findPlaylistTracks(context, id);
    },
    playlistsFriends() {
      return [];
    },
  },
  Mutation: {
    playlistCreate(parent, { name, trackIds }, context) {
      return TrackService.createPlaylist(context, name, trackIds);
    },
    playlistAddTracks(parent, { id, trackIds }, context) {
      return TrackService.insertPlaylistTracks(context, id, trackIds);
    },
  },
};

export default resolvers;
