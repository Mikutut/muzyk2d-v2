//#region Imports
	import { M2D_LogUtils } from "./log";
	import { nanoid } from "nanoid";
	import { M2D_EErrorTypes, M2D_GeneralUtils, M2D_IError } from "./utils";
	import { M2D_ICommand, M2D_ICommandParameterDesc, M2D_ICommandCategory, M2D_CATEGORIES, M2D_ICommandSuppParameters, M2D_CommandUtils, M2D_ICommandsMissingSuppParametersError, M2D_ECommandsErrorSubtypes } from "./commands"
	import { M2D_EYTAPIErrorSubtypes, M2D_IYTAPIVideoMetadata, M2D_IYTAPIWrongUrlError, M2D_YTAPIUtils } from "./youtubeapi";
	import { GuildMember } from "discord.js";
	import { M2D_ClientUtils } from "./client";
	import { M2D_IPlayback, M2D_PlaybackUtils } from "./playback";
	import { M2D_ConfigUtils } from "./config";
	import { M2D_MessagesUtils } from "./messages";
	import { M2D_EVoiceErrorSubtypes, M2D_VoiceUtils, M2D_IVoiceUserNotInTheSameVoiceChannelError } from "./voice";
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
			EndOfPlaylistReached = "END_OF_PLAYLIST_REACHED",
			MaxPlaylistSizeReached = "MAX_PLAYLIST_SIZE_REACHED"
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
		interface M2D_IPlaylistMaxPlaylistSizeReachedError extends M2D_IError {
			data: {
				guildId: string;
			}
		}

		type M2D_PlaylistError = M2D_IPlaylistNoPlaylistError |
			M2D_IPlaylistNoEntryError |
			M2D_IPlaylistEmptyPlaylistError |
			M2D_IPlaylistEndOfPlaylistReachedError |
			M2D_IPlaylistMaxPlaylistSizeReachedError;
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
	addPlaylistEntry: (guildId: string, options: M2D_IPlaylistEntryOptions) => new Promise<M2D_IPlaylistEntry>((res, rej) => {
		if(!M2D_PlaylistUtils.doesPlaylistExist(guildId)) M2D_PlaylistUtils.createPlaylist(guildId);

		M2D_ConfigUtils.getConfigValue("maxPlaylistSize", guildId)
			.then((val: string) => {
				const mPS = parseInt(val, 10);

				return M2D_PlaylistUtils.getPlaylist(guildId)
					.then((pl: M2D_IPlaylistEntry[]) => {
						if(pl.length < mPS) {
							const idx = M2D_PLAYLISTS.findIndex((v) => v.guildId === guildId);
							const plIdx = nanoid(4);
							const playlistEntry: M2D_IPlaylistEntry = {
								id: plIdx,
								...options
							};
							M2D_PLAYLISTS[idx].playlist.push(playlistEntry);
							res(playlistEntry);
						} else return Promise.reject({
							type: M2D_EErrorTypes.Playlist,
							subtype: M2D_EPlaylistErrorSubtypes.MaxPlaylistSizeReached,
							data: {
								guildId
							}
						} as M2D_IPlaylistMaxPlaylistSizeReachedError);
					})
					.catch((err) => Promise.reject(err));
			})
			.catch((err) => rej(err))
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
	}),
	getCurrentPlaylistEntry: (guildId: string) => new Promise<M2D_IPlaylistEntry>((res, rej) => {
		M2D_PlaybackUtils.getPlayback(guildId)
			.then((pB) => M2D_PlaylistUtils.getEntry(guildId, pB.currentPlaylistEntryId))
			.then((pE) => res(pE))
			.catch((err) => rej(err));	
	}),
	getEntry: (guildId: string, entryId: string) => new Promise<M2D_IPlaylistEntry>((res, rej) => {
		M2D_PlaylistUtils.getPlaylist(guildId)
			.then((pl) => {
				if(pl.length > 0) {
					const pe = pl.find((v) => v.id === entryId);

					if(pe) {
						res(pe);
					} else rej({
						type: M2D_EErrorTypes.Playlist,
						subtype: M2D_EPlaylistErrorSubtypes.NoEntry,
						data: {
							guildId,
							entryId
						}
					} as M2D_IPlaylistNoEntryError);
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
	initPlaylistCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie playlist...`)
			.then(() => M2D_LogUtils.logMessage(`success`, `Zainicjalizowano playlisty!`)
				.then(() => M2D_CommandUtils.addCommands(M2D_PLAYLIST_COMMANDS))
				.then(() => res())
			)
			.catch(err => rej(err));
	}),
	playlistExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wyłączanie playlist...`)
			.then(() => M2D_LogUtils.logMessage(`success`, `Wyłączono playlisty!`)
				.then(() => res())
			)
			.catch(err => rej(err));
	})
};

const M2D_PLAYLIST_COMMANDS: M2D_ICommand[] = [
	{
		name: "dodaj",
		aliases: ["d"],
		category: M2D_CATEGORIES.playlist,
		description: "Dodaje utwór do playlisty",
		parameters: [
			{
				name: "url",
				label: "URL",
				description: "URL wideo do odtworzenia (z YouTube'a)",
				required: true
			}
		],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "url")
					.then((val) => {
						const url = val;

						return M2D_YTAPIUtils.parseUrl(url)
							.then((videoId: string) => M2D_YTAPIUtils.getVideoMetadata(videoId))
							.then((metadata: M2D_IYTAPIVideoMetadata) => M2D_VoiceUtils.isUserConnectedToTheSameVoiceChannel(guild.id, user)
								.then((val) => {
									if(val) {
										return Promise.resolve(metadata);
									} else return Promise.reject({
										type: M2D_EErrorTypes.Voice,
										subtype: M2D_EVoiceErrorSubtypes.UserNotInTheSameVoiceChannel,
										data: {
											guildId: guild.id,
											channelId: guild.me?.voice.channelId,
											userId: user.id
										}
									} as M2D_IVoiceUserNotInTheSameVoiceChannelError);
								})
							)
							.then((metadata: M2D_IYTAPIVideoMetadata) => M2D_PlaylistUtils.addPlaylistEntry(guild.id, {
								url,
								...metadata,
								requestedBy: ((message.member as GuildMember).nickname) ? `${(message.member as GuildMember).nickname} (${user.tag})` : `${user.tag}`
							}))
							.then((pe: M2D_IPlaylistEntry) => M2D_MessagesUtils.getMessage("playlistAddedEntry", undefined, pe.thumbnailUrl, undefined, [
								{ name: "ID wpisu", value: `\`${pe.id}\``, inline: false },
								{ name: "Tytuł", value: `\`${pe.title}\``, inline: false },
								{ name: "Autor", value: `\`${pe.author}\``, inline: false },
								{	name: "Dodano przez", value: `\`${pe.requestedBy}\``, inline: false }
							]))
							.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
								embeds: [
									msg
								]
							}))
							.then(() => res())
							.catch(err => rej(err));
					})
					.catch((err) => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				switch(M2D_GeneralUtils.getErrorString(error)) {
					case "YOUTUBEAPI_WRONG_URL":
						M2D_CommandUtils.getParameterValue(parameters, "url")
							.then((url: string) => M2D_MessagesUtils.getMessage("youtubeAPIWrongUrl", [ url ]))
							.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
								embeds: [ msg ]
							}))
							.then(() => res())
							.catch((err) => rej(err));
					break;
					default:
						rej(error);	
				}
			} else rej(error);
			
			//rej(error);
		})
	},
	{
		name: "usuń",
		aliases: ["u"],
		category: M2D_CATEGORIES.playlist,
		description: "Usuwa wpis z playlisty",
		parameters: [
			{
				name: "id",
				label: "ID",
				description: "ID wpisu na playliście",
				required: true
			}
		],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "id")
					.then((peId) => M2D_VoiceUtils.isUserConnectedToTheSameVoiceChannel(guild.id, user)
						.then((val) => {
							if(val) {
								return Promise.resolve(peId);
							} else return Promise.reject({
								type: M2D_EErrorTypes.Voice,
								subtype: M2D_EVoiceErrorSubtypes.UserNotInTheSameVoiceChannel,
								data: {
									guildId: guild.id,
									channelId: guild.me?.voice.channelId,
									userId: user.id
								}
							} as M2D_IVoiceUserNotInTheSameVoiceChannelError);
						})
					)
					.then((peId: string) => M2D_PlaylistUtils.deletePlaylistEntry(guild.id, peId)
						.then(() => peId)
					)
					.then((peId) => M2D_MessagesUtils.getMessage("playlistDeletedEntry", [ peId ]))
					.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							msg
						]
					}))	
					.then(() => res())
					.catch((err) => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError)
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	},
	{
		name: "wyczyśćPlaylistę",
		aliases: ["wp"],
		category: M2D_CATEGORIES.playlist,
		description: "Czyści playlistę",
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;


				M2D_VoiceUtils.isUserConnectedToTheSameVoiceChannel(guild.id, user)
					.then((val) => {
						if(val) {
							return Promise.resolve();
						} else return Promise.reject({
							type: M2D_EErrorTypes.Voice,
							subtype: M2D_EVoiceErrorSubtypes.UserNotInTheSameVoiceChannel,
							data: {
								guildId: guild.id,
								channelId: guild.me?.voice.channelId,
								userId: user.id
							}
						} as M2D_IVoiceUserNotInTheSameVoiceChannelError);
					})
					.then(() => M2D_PlaylistUtils.flushPlaylist(guild.id)
						.then(() => M2D_MessagesUtils.getMessage("playlistFlushedPlaylist"))
						.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
							embeds: [	msg ]
						}))
						.catch((err) => Promise.reject(err))
					)
					.then(() => res())
					.catch((err) => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError)
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	},
	{
		name: "wyświetlPlaylistę",
		aliases: ["w", "poka"],
		category: M2D_CATEGORIES.playlist,
		description: "Wyświetla zawartość playlisty",
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_PlaylistUtils.getPlaylist(guild.id)
					.then((pl: M2D_IPlaylistEntry[]) => {
						const ids: string[] = [];
						const titles: string[] = [];
						const authors: string[] = [];
						const requestedBys: string[] = [];

						for(const v of pl) {
							ids.push(v.id);
							titles.push(v.title);
							authors.push(v.author);
							requestedBys.push(v.requestedBy);
						}

						return {
							ids,
							titles,
							authors,
							requestedBys
						};
					})
					.then((data: { ids: string[]; titles: string[]; authors: string[]; requestedBys: string[], playback?: M2D_IPlayback }) => M2D_PlaybackUtils.getPlayback(guild.id)
						.then((pe: M2D_IPlayback) => {
							const repackedData = { ...data };

							repackedData.playback = pe;
							return repackedData;
						})
						.catch((err) => M2D_LogUtils.logMultipleMessages(`warn`, [ `GID: "${guild.id}" - nie udało się uzyskać odtworzenia!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"` ])
							.then(() => data)
						)
					)
					.then((data: { ids: string[]; titles: string[]; authors: string[]; requestedBys: string[], playback?: M2D_IPlayback }) => {
						let outputString = `\n`;
						let isBeingPlayed: boolean;
						const playlistLength = data.ids.length;

						for(let i = 0; i < playlistLength; i++) {
							if(data.playback !== undefined) {
								if(data.playback.currentPlaylistEntryId === data.ids[i]) {
									isBeingPlayed = true;
								} else isBeingPlayed = false;
							} else isBeingPlayed = false;
							outputString = outputString.concat(`\n**${data.ids[i]}**\nTytuł: **${data.titles[i]}**\nAutor: **${data.authors[i]}**\nDodane przez: **${data.requestedBys[i]}**\n${(isBeingPlayed) ? "*OBECNIE ODTWARZANY*\n\n" : ""}\n`);
						}

						return outputString;
					})
					.then((oS: string) => { 
						if(oS === '\n') {
							return M2D_MessagesUtils.getMessage("playlistEmptyPlaylist")
								.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
									embeds: [ msg ]
								}));
						} else return M2D_MessagesUtils.getMessage("playlistShowPlaylist", [ oS ])
							.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
								embeds: [ msg ]
							}));
					})
					.then(() => res())
					.catch((err) => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError)
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	}
];

//#region Exports
	export type {
		M2D_IPlaylistEntry,
		M2D_IPlaylistsListEntry,
		M2D_IPlaylistNoPlaylistError,
		M2D_IPlaylistNoEntryError,
		M2D_IPlaylistEmptyPlaylistError,
		M2D_IPlaylistEndOfPlaylistReachedError,
		M2D_IPlaylistMaxPlaylistSizeReachedError,
		M2D_PlaylistError
	};
	export {
		M2D_EPlaylistErrorSubtypes,
		M2D_PlaylistUtils
	};
//#endregion