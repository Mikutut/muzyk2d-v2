//#region Imports
	import { nanoid } from "nanoid";
	import { M2D_EErrorTypes, M2D_IError } from "utils";
//#endregion

//#region Types
	interface M2D_IPlaylistEntry {
		id: string;
		url: string;
		title: string;
		author: string;
		requestedBy: string;
		thumbnailUrl: string;
	};
	interface M2D_IPlaylistEntryOptions {
		url: string;
		title: string;
		author: string;
		requestedBy: string;
		thumbnailUrl: string;
	};
	interface M2D_IPlaylistsListEntry {
		guildId: string;
		playlist: M2D_IPlaylistEntry[];
	}
	//#region Error types
		const enum M2D_EPlaylistErrorSubtypes {
			NoPlaylist = "NO_PLAYLIST",
			NoEntry = "NO_ENTRY",
			EmptyPlaylist = "EMPTY_PLAYLIST",
			EndOfPlaylistReached = "END_OF_PLAYLIST_REACHED"
		};
		interface M2D_IPlaylistNoPlaylistError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IPlaylistNoEntryError extends M2D_IError {
			data: {
				guildId: string;
				entryId: string;
			}
		};
		interface M2D_IPlaylistEmptyPlaylistError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IPlaylistEndOfPlaylistReachedError extends M2D_IError {
			data: {
				guildId: string;
			}
		};

		type M2D_PlaylistError = M2D_IPlaylistNoPlaylistError |
			M2D_IPlaylistNoEntryError |
			M2D_IPlaylistEmptyPlaylistError |
			M2D_IPlaylistEndOfPlaylistReachedError;
	//#endregion
//#endregion

const M2D_PLAYLISTS: M2D_IPlaylistsListEntry[] = [];

const M2D_PlaylistUtils = {
	doesPlaylistExist: (guildId: string) => M2D_PLAYLISTS.find((v) => v.guildId === guildId) !== undefined,
	doesEntryExist: (playlist: M2D_IPlaylistEntry[], entryId: string) => {
		if(playlist.find((v) => v.id === entryId)) return true;
		else return false;
	},
	createPlaylist: (guildId: string) => {
		if(!M2D_PlaylistUtils.doesPlaylistExist(guildId)) {
			M2D_PLAYLISTS.push({
				guildId,
				playlist: []
			});
		}
	},
	deletePlaylist: (guildId: string) => {
		if(M2D_PlaylistUtils.doesPlaylistExist(guildId)) {
			const idx = M2D_PLAYLISTS.findIndex((v) => v.guildId === guildId);
			M2D_PLAYLISTS.splice(idx, 1);
		}
	},
	getPlaylist: (guildId: string) => new Promise<M2D_IPlaylistEntry[]>((res, rej) => {
		if(M2D_PlaylistUtils.doesPlaylistExist(guildId)) {
			const pl = (M2D_PLAYLISTS.find((v) => v.guildId === guildId) as M2D_IPlaylistsListEntry).playlist;
			res(pl);
		} else rej({
			type: M2D_EErrorTypes.Playlist,
			subtype: M2D_EPlaylistErrorSubtypes.NoPlaylist,
			data: {
				guildId
			}
		} as M2D_IPlaylistNoPlaylistError);
	}),
	flushPlaylist: (guildId: string) => new Promise<void>((res, rej) => {
		if(M2D_PlaylistUtils.doesPlaylistExist(guildId)) {
			const idx = M2D_PLAYLISTS.findIndex((v) => v.guildId === guildId);
			M2D_PLAYLISTS[idx].playlist = [];
			res();
		} else rej({
			type: M2D_EErrorTypes.Playlist,
			subtype: M2D_EPlaylistErrorSubtypes.NoPlaylist,
			data: {
				guildId
			}
		} as M2D_IPlaylistNoPlaylistError);
	}),
	addPlaylistEntry: (guildId: string, options: M2D_IPlaylistEntryOptions) => new Promise<string>((res, rej) => {
		if(!M2D_PlaylistUtils.doesPlaylistExist(guildId)) M2D_PlaylistUtils.createPlaylist(guildId);

		const idx = M2D_PLAYLISTS.findIndex((v) => v.guildId === guildId);
		const plIdx = nanoid(10);
		M2D_PLAYLISTS[idx].playlist.push({
			id: plIdx,
			...options
		});
		res(plIdx);
	}),
	deletePlaylistEntry: (guildId: string, entryId: string) => new Promise<void>((res, rej) => {
		M2D_PlaylistUtils.getPlaylist(guildId)
			.then(pl => {
				if(M2D_PlaylistUtils.doesEntryExist(pl, entryId)) {
					const idx = M2D_PLAYLISTS.findIndex((v) => v.guildId === guildId);
					const eIdx = M2D_PLAYLISTS[idx].playlist.findIndex((v) => v.id === entryId);

					M2D_PLAYLISTS[idx].playlist.splice(eIdx, 1);
					res();
				} else rej({
					type: M2D_EErrorTypes.Playlist,
					subtype: M2D_EPlaylistErrorSubtypes.NoEntry,
					data: {
						guildId,
						entryId
					}
				} as M2D_IPlaylistNoEntryError);
			})
			.catch(() => rej({
				type: M2D_EErrorTypes.Playlist,
				subtype: M2D_EPlaylistErrorSubtypes.NoPlaylist,
				data: {
					guildId
				}
			} as M2D_IPlaylistNoPlaylistError));
	}),
	isPlaylistEnd: (guildId: string, entryId: string) => new Promise<boolean>((res, rej) => {
		M2D_PlaylistUtils.getPlaylist(guildId)
			.then((pl) => {
				if(M2D_PlaylistUtils.doesEntryExist(pl, entryId)) {
					const eIdx = pl.findIndex((v) => v.id === entryId);

					res(eIdx === (pl.length - 1));
				} else rej({
					type: M2D_EErrorTypes.Playlist,
					subtype: M2D_EPlaylistErrorSubtypes.NoEntry,
					data: {
						guildId,
						entryId
					}
				} as M2D_IPlaylistNoEntryError);
			})
			.catch(() => rej({
				type: M2D_EErrorTypes.Playlist,
				subtype: M2D_EPlaylistErrorSubtypes.NoPlaylist,
				data: {
					guildId
				}
			} as M2D_IPlaylistNoPlaylistError));
	}),
	getFirstEntry: (guildId: string) => new Promise<M2D_IPlaylistEntry>((res, rej) => {
		M2D_PlaylistUtils.getPlaylist(guildId)
			.then((pl) => {
				if(pl.length > 0) {
					res(pl[0]);
				} else rej({
					type: M2D_EErrorTypes.Playlist,
					subtype: M2D_EPlaylistErrorSubtypes.EmptyPlaylist,
					data: {
						guildId
					}
				} as M2D_IPlaylistEmptyPlaylistError);
			})
			.catch(() => rej({
				type: M2D_EErrorTypes.Playlist,
				subtype: M2D_EPlaylistErrorSubtypes.NoPlaylist,
				data: {
					guildId
				}
			} as M2D_IPlaylistNoPlaylistError));
	}),
	getNextEntry: (guildId: string, currentEntryId: string) => new Promise<M2D_IPlaylistEntry>((res, rej) => {
		M2D_PlaylistUtils.getPlaylist(guildId)
			.then((pl) => {
				if(pl.length > 0) {
					const curIdx = pl.findIndex((v) => v.id === currentEntryId);

					if((curIdx + 1) <= (pl.length - 1)) {
						res(pl[curIdx+1]);
					} else rej({
						type: M2D_EErrorTypes.Playlist,
						subtype: M2D_EPlaylistErrorSubtypes.EndOfPlaylistReached,
						data: {
							guildId
						}
					} as M2D_IPlaylistEndOfPlaylistReachedError)
				} else rej({
					type: M2D_EErrorTypes.Playlist,
					subtype: M2D_EPlaylistErrorSubtypes.EmptyPlaylist,
					data: {
						guildId
					}
				} as M2D_IPlaylistEmptyPlaylistError);
			})
			.catch(() => rej({
				type: M2D_EErrorTypes.Playlist,
				subtype: M2D_EPlaylistErrorSubtypes.NoPlaylist,
				data: {
					guildId
				}
			} as M2D_IPlaylistNoPlaylistError));
	})
};

//#region Exports
	export type {
		M2D_IPlaylistEntry,
		M2D_IPlaylistsListEntry,
		M2D_IPlaylistNoPlaylistError,
		M2D_IPlaylistNoEntryError,
		M2D_IPlaylistEmptyPlaylistError,
		M2D_IPlaylistEndOfPlaylistReachedError,
		M2D_PlaylistError
	};
	export {
		M2D_EPlaylistErrorSubtypes,
		M2D_PlaylistUtils
	};
//#endregion