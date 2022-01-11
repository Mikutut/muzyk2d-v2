//#region Imports
	import { version as M2DVersion, author as M2DAuthor } from "./package.json";
	import { config as dotenvConfig } from "dotenv";
	import { EmbedField, MessageEmbed, MessageOptions, TextChannel, ThreadChannel } from "discord.js";
	import { M2D_ConfigUtils, M2D_EConfigErrorSubtypes, M2D_ConfigError } from "./config";
	import { M2D_LogUtils, M2D_ELogErrorSubtypes, M2D_LogError } from "./log";
	import { M2D_EClientErrorSubtypes, M2D_ClientError, M2D_ClientUtils, M2D_IClientWrongChannelTypeError } from "./client";
	import { M2D_ECommandsErrorSubtypes, M2D_CommandsError } from "./commands";
	import { M2D_EVoiceErrorSubtypes, M2D_VoiceError, M2D_VoiceUtils } from "./voice";
	import { M2D_EPlaylistErrorSubtypes, M2D_PlaylistError, M2D_PlaylistUtils } from "./playlist";
	import { M2D_EPlaybackErrorSubtypes, M2D_PlaybackError, M2D_PlaybackUtils } from "./playback";
	import { M2D_EYTAPIErrorSubtypes, M2D_YTAPIError, M2D_YTAPIUtils } from "./youtubeapi";
	import { M2D_EMessagesErrorSubtypes, M2D_MessagesError, M2D_MessagesUtils } from "./messages";
	import { M2D_EStatusErrorSubtypes, M2D_StatusError, M2D_StatusUtils } from "./status";
//#endregion

//#region Types
	type M2D_EmbedType = "info" | "success" | "error";
	interface M2D_IEmbedOptions {
		title?: string;
		description: string;
		type: M2D_EmbedType;
		imageURL?: string;
		thumbnailURL?: string;
		fields?: EmbedField[];
	};
	const enum M2D_EErrorTypes {
		General = "GENERAL",
		Commands = "COMMANDS",
		Client = "CLIENT",
		Config = "CONFIG",
		Log = "LOG",
		Voice = "VOICE",
		Playback = "PLAYBACK",
		Playlist = "PLAYLIST",
		YTAPI = "YOUTUBEAPI",
		Messages = "MESSAGES",
		Status = "STATUS",
		Unknown = "UNKNOWN"
	};

	type M2D_ErrorSubtypes = "UNKNOWN" |
		M2D_EGeneralErrorSubtypes |
		M2D_EConfigErrorSubtypes |
		M2D_ELogErrorSubtypes |
		M2D_EClientErrorSubtypes |
		M2D_ECommandsErrorSubtypes |
		M2D_EVoiceErrorSubtypes |
		M2D_EPlaylistErrorSubtypes |
		M2D_EPlaybackErrorSubtypes |
		M2D_EYTAPIErrorSubtypes |
		M2D_EMessagesErrorSubtypes |
		M2D_EStatusErrorSubtypes;

	interface M2D_IError {
		type: M2D_EErrorTypes;
		subtype: M2D_ErrorSubtypes;
		data: Record<string, any>;
	};

	type M2D_Error = M2D_IUnknownError |
		M2D_GeneralError |
		M2D_ConfigError |
		M2D_ClientError |
		M2D_LogError |
		M2D_CommandsError |
		M2D_VoiceError |
		M2D_PlaylistError |
		M2D_PlaybackError |
		M2D_YTAPIError |
		M2D_MessagesError |
		M2D_StatusError;

	//#region Error types
		const enum M2D_EGeneralErrorSubtypes {
			NoEnvVariable = "NO_ENV_VARIABLE",
			DevModeUserNotAllowed = "DEV_MODE_USER_NOT_ALLOWED"
		};
		interface M2D_IUnknownError extends M2D_IError {
			data: {
				errorData: unknown;
			}
		};
		interface M2D_IGeneralNoEnvVariableError extends M2D_IError {
			data: {
				envVariable: string;
			};
		};
		interface M2D_IGeneralDevModeUserNotAllowedError extends M2D_IError {
			data: {
				userId: string;
			}
		};

		type M2D_GeneralError = M2D_IGeneralNoEnvVariableError |
			M2D_IGeneralDevModeUserNotAllowedError;
	//#endregion
//#endregion

dotenvConfig();

const M2D_DEV_ALLOWED_USERS: string[] = [];

const M2D_GeneralUtils = {
	getMuzyk2DVersion: () => M2DVersion,
	getMuzyk2DAuthor: () => M2DAuthor,
	getEnvVar: (envVar: string) => new Promise<string>((res, rej) => {
		if(process.env[`M2D_${envVar}`]) {
			res(process.env[`M2D_${envVar}`] as string);
		} else rej({
			type: M2D_EErrorTypes.General,
			subtype: M2D_EGeneralErrorSubtypes.NoEnvVariable,
			data: {
				envVariable: envVar
			}
		} as M2D_IGeneralNoEnvVariableError);
	}),
	isDevModeEnabled: () => new Promise<boolean>((res, rej) => {
		M2D_GeneralUtils.getEnvVar("DEV_MODE")
			.then((val) => {
				if(val === "true") res(true);
				else res(false);
			})
			.catch(() => res(false));
	}),
	embedBuilder: (options: M2D_IEmbedOptions): MessageEmbed => {
		const embed = new MessageEmbed();

		switch(options.type) {
			case "error":
				embed.setColor("#C80000");
			break;
			case "info":
				embed.setColor("#0095CD");
			break;
			case "success":
				embed.setColor("#00C800");
			break;
		}

		if(options.title) embed.setTitle(options.title);
		if(options.fields) embed.setFields(...options.fields);
		if(options.imageURL) embed.setImage(options.imageURL);
		if(options.thumbnailURL) embed.setThumbnail(options.thumbnailURL);

		embed.setDescription(options.description);
		embed.setTimestamp(new Date());
		embed.setFooter(`Muzyk2D - v${M2D_GeneralUtils.getMuzyk2DVersion()}`);
		
		return embed;
	},
	exitHandler: (exitCode: number) => {
		M2D_LogUtils.logMessage("info", "Trwa wyłączanie Muzyka2D...")
			.then(() => M2D_ConfigUtils.configExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_LogUtils.logExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_PlaylistUtils.playlistExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_PlaybackUtils.playbackExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_VoiceUtils.voiceExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_YTAPIUtils.YTAPIExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_StatusUtils.statusExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_ClientUtils.clientExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_GeneralUtils.generalExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => process.exit(exitCode));
	},
	getErrorString: (error: M2D_Error): string => {
		if(error.type !== M2D_EErrorTypes.Unknown) {
			return `${error.type}_${error.subtype}`;
		} else return `UNKNOWN`;
	},
	delay: (ms: number) => new Promise<void>((res, rej) => setTimeout(res, ms)),
	loadDevModeAllowedUsers: () => new Promise<void>((res, rej) => {
		M2D_GeneralUtils.getEnvVar("DEV_ALLOWED_USERS")
			.then((val: string) => {
				if(/\s/g.test(val)) {
					const allowedUsers = val.split(" ");

					M2D_DEV_ALLOWED_USERS.push(...allowedUsers);
				} else {
					M2D_DEV_ALLOWED_USERS.push(val);
				}
				res();
			})
			.catch((err) => rej(err));
	}),
	isUserDevModeAllowed: (userId: string) => M2D_DEV_ALLOWED_USERS.find((v) => v === userId) !== undefined,
	scheduleShutdown: (exitCode: number, s: number, reason?: string) => new Promise<void>((res, rej) => {
		M2D_MessagesUtils.getMessage("generalScheduleShutdown", [ s.toString(), (reason) ? reason : "Nie podano" ])
			.then((msg) => {
				const promisesToHandle: Promise<void>[] = [];
				for(const v of M2D_ClientUtils.getLastUsedChannels()) {
					promisesToHandle.push(M2D_ClientUtils.sendMessageInGuild(v.guildId, v.channelId, {
						embeds: [ msg ]
					}, true));
				}
				return Promise.allSettled(promisesToHandle)
					.then(() => M2D_GeneralUtils.delay(s * 1000))
					.then(() => M2D_GeneralUtils.exitHandler(exitCode ?? 0));	
			})
			.catch((err) => rej(err));
	}),
	sendDevMessage: (message: string, guildId?: string, channelId?: string) => new Promise<void>((res, rej) => {
		M2D_MessagesUtils.getMessage("generalDevMessage", [ message ])
			.then((msg) => {
		
				const promisesToHandle: Promise<void>[] = [];

				return M2D_MessagesUtils.getMessage("generalDevMessage", [ message ])
					.then((devMsg) => {
						return new Promise<TextChannel | ThreadChannel>((res2, rej2) => {
							if(guildId) {
								M2D_ClientUtils.getLastUsedChannel(guildId)
									.then((ch) => res2(ch))
									.catch((err) => rej2(err));
								if(channelId) {
									M2D_ClientUtils.getGuildChannelFromId(guildId, channelId)
										.then((ch) => {
											if(ch.type === "GUILD_TEXT") {
												res2(ch as TextChannel);
											} else if(ch.type === "GUILD_PUBLIC_THREAD") {
												res2(ch as ThreadChannel);
											} else rej2({
												type: M2D_EErrorTypes.Client,
												subtype: M2D_EClientErrorSubtypes.WrongChannelType,
												data: {
													guildId,
													channelId,
													expectedTypes: [ "GUILD_TEXT", "GUILD_PUBLIC_THREAD" ],
													receivedType: ch.type
												}
											} as M2D_IClientWrongChannelTypeError);
										})
										.catch((err) => rej2(err));
								}
							} else {
								rej2();
							}
						})
						.then((ch) => M2D_ClientUtils.sendMessageInGuild(guildId as string, ch.id, { embeds: [ devMsg ] }, true)
							.then(() => M2D_LogUtils.logMessage(`success`, `Wiadomość deweloperska została wysłana na kanał "${ch.name}" (${ch.id}) na serwerze o ID "${guildId}"`))
							.catch((err) => Promise.reject(err))
						)
						.then(() => res())
						.catch((err: M2D_Error | undefined) => {
							if(err) {
								M2D_LogUtils.logMultipleMessages(`error`, [`Wysłanie wiadomości deweloperskiej na serwer o ID "${guildId}" nie powiodło się!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`])
									.then(() => rej(err));
							} else {
								const promisesToHandle: Promise<any>[] = [];

								for(const v of M2D_ClientUtils.getLastUsedChannels()) {
									promisesToHandle.push(M2D_ClientUtils.sendMessageInGuild(v.guildId, v.channelId, { embeds: [ devMsg ] }, true));
								}
								return M2D_LogUtils.logMultipleMessages(`info`, [`Wysyłanie wiadomości deweloperskiej na ostatnio używane kanały tekstowe na wszystkich serwerach...`, `Wynik tej operacji będzie nieznany`])
									.then(() => Promise.allSettled(promisesToHandle))
									.then(() => res());
							}
						})
					})
					.catch((err) => Promise.reject(err));
		})
		.catch((err) => rej(err));
	}),
	ignoreError: (promise: Promise<any>) => new Promise<undefined | any>((res, rej) => {
		promise
			.then((ret_value: any) => res(ret_value))
			.catch(() => res(undefined));
	}),
	sendStartupMessage: (deleteMsg?: boolean) => new Promise<void>((res, rej) => {
		let isDevModeEnabled = false;

		M2D_GeneralUtils.ignoreError(
			M2D_GeneralUtils.isDevModeEnabled()
		)
			.then((isDevModeEn: boolean) => { isDevModeEnabled = isDevModeEn; })
			.then(() => {
				const promisesToHandle: Promise<any>[] = [];

				M2D_MessagesUtils.getMessage("generalStartupMessage", [ M2D_GeneralUtils.getMuzyk2DVersion(), M2D_GeneralUtils.getMuzyk2DAuthor(), (isDevModeEnabled) ? `\n\n**TRYB DEWELOPERSKI**` : `` ])
					.then((msg) => {
						const message: MessageOptions = {
							embeds: [ msg ]
						};
						
						for(const [i, v] of M2D_ClientUtils.getLastUsedChannels().entries()) {
							promisesToHandle.push(
								M2D_GeneralUtils.ignoreError(
									M2D_ClientUtils.getGuildChannelFromId(v.guildId, v.channelId)
										.then((ch) => M2D_ClientUtils.sendMessageInGuild(v.guildId, v.channelId, message, deleteMsg))
								)
							);
						}

						return M2D_LogUtils.logMultipleMessages(`info`, [`Wysyłanie startowej wiadomości...`, `Wynik tej operacji nie będzie znany.`])
							.then(() => Promise.allSettled(promisesToHandle)
								.then(() => Promise.resolve())
								.catch(() => Promise.resolve())
							);
				})
					.then(() => res())
					.catch((err) => rej(err));
			});
	}),
	initGeneralCapabilities: () => new Promise<void>((res, rej) => {
		console.log(`Inicjalizowanie ogólnych możliwości...`);
		M2D_GeneralUtils.loadDevModeAllowedUsers()
			.then(() => {
				console.log(`Zainicjalizowano ogólne możliwości!`);
				res();
			})
			.catch((err) => rej(err));
	}),
	generalExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wyłączanie ogólnych możliwości...`)
			.then(() => M2D_LogUtils.logMessage(`success`, `Wyłączono ogólne możliwości!`))
			.then(() => res())
			.catch((err) => rej(err))
	})
};


//#region Exports
export type {
	M2D_IError,
	M2D_IGeneralNoEnvVariableError,
	M2D_IGeneralDevModeUserNotAllowedError,
	M2D_IEmbedOptions,
	M2D_EmbedType,
	M2D_IUnknownError,
	M2D_Error
};
export {
	M2D_EErrorTypes,
	M2D_ErrorSubtypes,
	M2D_EGeneralErrorSubtypes,
	M2D_GeneralUtils
};
//#endregion