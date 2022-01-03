//#region Imports
	import { M2D_LogUtils } from "./log";
	import { nanoid } from "nanoid";
	import { M2D_EErrorTypes, M2D_GeneralUtils, M2D_IError } from "./utils";
	import { M2D_ICommand, M2D_ICommandParameterDesc, M2D_ICommandCategory, M2D_CATEGORIES, M2D_ICommandSuppParameters, M2D_CommandUtils, M2D_ICommandsMissingSuppParametersError, M2D_ECommandsErrorSubtypes } from "./commands"
	import { M2D_EYTAPIErrorSubtypes, M2D_IYTAPIVideoMetadata, M2D_IYTAPIWrongUrlError, M2D_YTAPIUtils } from "./youtubeapi";
	import { GuildMember } from "discord.js";
	import { M2D_ClientUtils } from "./client";
	import { M2D_IPlayback, M2D_PlaybackUtils } from "./playback";
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
	addPlaylistEntry: (guildId: string, options: M2D_IPlaylistEntryOptions) => new Promise<M2D_IPlaylistEntry>((res, rej) => {
		if(!M2D_PlaylistUtils.doesPlaylistExist(guildId)) M2D_PlaylistUtils.createPlaylist(guildId);

		const idx = M2D_PLAYLISTS.findIndex((v) => v.guildId === guildId);
		const plIdx = nanoid(10);
		const playlistEntry: M2D_IPlaylistEntry = {
			id: plIdx,
			...options
		};
		M2D_PLAYLISTS[idx].playlist.push(playlistEntry);
		res(playlistEntry);
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
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "url")
					.then((val) => {
						const url = val;

						M2D_YTAPIUtils.parseUrl(url)
							.then((videoId: string) => M2D_YTAPIUtils.getVideoMetadata(videoId))
							.then((metadata: M2D_IYTAPIVideoMetadata) => M2D_PlaylistUtils.addPlaylistEntry(guild.id, {
								url,
								...metadata,
								requestedBy: ((message.member as GuildMember).nickname) ? `${(message.member as GuildMember).nickname} (${user.tag})` : `${user.tag}`
							}))
							.then((pe: M2D_IPlaylistEntry) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
								embeds: [
									M2D_GeneralUtils.embedBuilder({
										type: "success",
										title: "Dodano wpis do playlisty!",
										description: `Pomyślnie **dodano nowy wpis do playlisty**!\n**ID wpisu** (potrzebne do ewentualnego usuwania pozycji): \`${pe.id}\``,
										fields: [
											{
												name: "Tytuł",
												value: pe.title,
												inline: true
											},
											{
												name: "Autor",
												value: pe.author,
												inline: true
											},
											{
												name: "Dodano przez",
												value: pe.requestedBy,
												inline: true
											}
										],
										thumbnailURL: pe.thumbnailUrl
									})
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
			rej(error);
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
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				let peId: string;

				M2D_CommandUtils.getParameterValue(parameters, "id")
					.then((val: string) => { peId = val; })
					.then(() => M2D_PlaylistUtils.deletePlaylistEntry(guild.id, peId))
					.then(() => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "success",
								title: "Usunięto wpis!",
								description: `Pomyślnie **usunięto wpis o ID** \`${peId}\` **z playlisty**!`
							})
						]
					}))	
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
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_PlaylistUtils.flushPlaylist(guild.id)
					.then(() => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "success",
								title: `Wyczyszczono playlistę!`,
								description: `Pomyślnie **wyczyszczono playlistę**!`
							})
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
		name: "wyświetlPlaylistę",
		aliases: ["w", "poka"],
		category: M2D_CATEGORIES.playlist,
		description: "Wyświetla zawartość playlisty",
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_PlaylistUtils.getPlaylist(guild.id)
					.then((playlist: M2D_IPlaylistEntry[]) => {
						let outputString = `\n`;
						let playlistEntry: M2D_IPlayback | undefined;

						M2D_PlaybackUtils.getPlayback(guild.id)
							.then((pe: M2D_IPlayback) => { playlistEntry = pe; })
							.catch(() => {return;});

						for(const v of playlist) {
							outputString = outputString.concat(`---\n**${v.id}**\nTytuł: **${v.title}**\nAutor: **${v.author}**\nDodane przez: **${v.requestedBy}**\n${(playlistEntry && playlistEntry.currentPlaylistEntryId === v.id) ? "*OBECNIE ODTWARZANY*\n" : ""}---\n`);
						}

						return outputString;
					})
					.then((oS: string) => { 
						if(oS === '\n') {
							return M2D_ClientUtils.sendMessageReplyInGuild(message, {
								embeds: [
									M2D_GeneralUtils.embedBuilder({
										type: "error",
										title: `Playlista`,
										description: `Playlista jest **pusta**!`
									})
								]
							});
						} else return M2D_ClientUtils.sendMessageReplyInGuild(message, {
								embeds: [
									M2D_GeneralUtils.embedBuilder({
										type: "info",
										title: `Playlista`,
										description: oS
									})
								]
							});
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
		M2D_PlaylistError
	};
	export {
		M2D_EPlaylistErrorSubtypes,
		M2D_PlaylistUtils
	};
//#endregion