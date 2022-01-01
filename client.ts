//#region Imports
	import { M2D_ConfigUtils } from "./config";
	import { Client, Guild, Channel, GuildMember, User, Intents, Message, TextChannel, DMChannel, GuildBasedChannel, PermissionFlags } from "discord.js";
	import { M2D_LogUtils } from "./log";
	import { M2D_EErrorTypes, M2D_Error, M2D_GeneralUtils, M2D_IError } from "./utils";
	import { M2D_CommandUtils, M2D_ECommandsErrorSubtypes, M2D_ICommand, M2D_ICommandParameter, M2D_ICommandsCommandDeveloperOnlyError, M2D_ICommandsCommandNotActiveError, M2D_ICommandsCommandNotInvokableInChatError, M2D_ICommandsInsufficientParametersError, M2D_ICommandsMissingCommandError, M2D_ICommandSuppParameters } from "./commands";
	import { M2D_VoiceUtils } from "./voice";
//#endregion

//#region Types
	interface M2D_IClientParsedMessage {
		fullCommand: string;
		keyword: string;
		parameters: string[];
	};
	//#region Error types
		const enum M2D_EClientErrorSubtypes {
			DiscordAPI = "DISCORD_API",
			MessageInvalid = "MESSAGE_INVALID",
			MissingGuild = "MISSING_GUILD",
			MissingChannel = "MISSING_CHANNEL",
			MissingGuildChannel = "MISSING_GUILD_CHANNEL",
			MissingUser = "MISSING_USER",
			InsufficientPermissions = "INSUFFICIENT_PERMISSIONS"
		};
		const enum M2D_EClientMessageInvalidErrorTypes {
			NotStartingWithPrefix = "MESSAGE_NOT_STARTING_WITH_PREFIX",
			TooShort = "MESSAGE_TOO_SHORT"
		};
		interface M2D_IClientDiscordAPIError extends M2D_IError {
			data: {
				errorMessage: string;
			}
		};
		interface M2D_IClientMessageInvalidError extends M2D_IError {
			data: {
				type: M2D_EClientMessageInvalidErrorTypes;
				message: string;
			}
		};
		interface M2D_IClientMissingGuildError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IClientMissingChannelError extends M2D_IError {
			data: {
				channelId: string;
			}
		};
		interface M2D_IClientMissingGuildChannelError extends M2D_IError {
			data: {
				guildId: string;
				channelId: string;
			}
		};
		interface M2D_IClientMissingUserError extends M2D_IError {
			data: {
				userId: string;
			}
		};
		interface M2D_IClientInsufficientPermissionsError extends M2D_IError {
			data: {
				guild: Guild;
				channel?: GuildBasedChannel;
				permissions: string[];
			}
		};

		type M2D_ClientError = M2D_IClientDiscordAPIError |
			M2D_IClientMessageInvalidError |
			M2D_IClientMissingGuildError |
			M2D_IClientMissingChannelError |
			M2D_IClientMissingGuildChannelError |
			M2D_IClientMissingUserError |
			M2D_IClientInsufficientPermissionsError;
	//#endregion
//#endregion

const M2D_Client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_VOICE_STATES,
		Intents.FLAGS.GUILD_MESSAGE_TYPING,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_VOICE_STATES
	]
});

const M2D_ClientUtils = {
	getClient: () => M2D_Client,
	loginClient: (token: string) => new Promise<void>((res, rej) => {
		M2D_Client.login(token)
			.then(() => res())
			.catch((err) => rej({
				type: M2D_EErrorTypes.Client,
				subtype: M2D_EClientErrorSubtypes.DiscordAPI,
				data: {
					errorMessage: err.message
				}
			} as M2D_IClientDiscordAPIError));
	}),
	initEventHandlers: () => {
		M2D_Client.on("ready", () => {
			console.log(`Rozpoczęto wstępną inicjalizację...`);
			M2D_LogUtils.initLogCapabilities()
				.then(() => M2D_CommandUtils.initCommandCapabilities())
				.then(() => M2D_ConfigUtils.initConfigCapabilities())
				.then(() => M2D_VoiceUtils.initVoiceCapabilities())
				.then(() => {
					M2D_LogUtils.logMessage("success", `Muzyk2D (v${M2D_GeneralUtils.getMuzyk2DVersion()}) - gotowy do działania!`);
				})
				.catch((err: M2D_Error) => {
					M2D_LogUtils.logMultipleMessages("error", `Wystąpił błąd podczas wstępnej inicjalizacji!`, `Oznaczenie błędu: ${M2D_GeneralUtils.getErrorString(err)}`, `Informacje o błędzie: "${JSON.stringify(err.data)}"`, `Muzyk2D przejdzie do samowyłączenia.`)
						.then(() => M2D_GeneralUtils.exitHandler(1));
				})
		});
		M2D_Client.on("messageCreate", (message: Message) => {
			try {
				const guild = message.guild;

				if(guild) {
					const guildId = guild.id;

					M2D_ConfigUtils.getConfigValue("prefix", guildId)
						.then((prefix) => M2D_ClientUtils.parseMessage(message.content, prefix)
								.then((parsedMessage) => M2D_LogUtils.logMessage(`info`, `Wykryto nowe żądanie wywołania komendy "${parsedMessage.fullCommand}" na serwerze "${guild.name}" (${guildId})`)
									.then(() => {
										const suppParameters: M2D_ICommandSuppParameters = {
											message,
											guild,
											channel: message.channel as TextChannel | DMChannel,
											user: message.author
										};

										M2D_ClientUtils.executeMessageCommand(parsedMessage, suppParameters)
											.catch((err: M2D_Error) => {return;});
									})
								)
								.catch(() => {return;})
						)
						.catch((error: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas interpretowania wiadomości!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(error)}"`, `Dane o błędzie: "${JSON.stringify(error.data)}"`));
				} else throw new Error("Guild was null");
			} catch(err) {
				M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił nieznany błąd podczas interpretowania wiadomości!`, `Tekst błędu: "${(err as Error).message}"`);
			}
		});
	},
	parseMessage: (messageContent: string, prefix: string) => new Promise<M2D_IClientParsedMessage>((res, rej) => {
		if(messageContent.startsWith(prefix)) {
			if(messageContent.length >= `${prefix} `.length) {
				const fullCommand = messageContent.replace(`${prefix} `, "");
				const keyword = fullCommand.split(" ")[0];
				const params = fullCommand.split(" ");
				params.shift();

				res({
					fullCommand,
					keyword,
					parameters: params
				});
			} else rej({
				type: M2D_EErrorTypes.Client,
				subtype: M2D_EClientErrorSubtypes.MessageInvalid,
				data: {
					type: M2D_EClientMessageInvalidErrorTypes.TooShort,
					message: messageContent
				}
			} as M2D_IClientMessageInvalidError);
		} else rej({
			type: M2D_EErrorTypes.Client,
			subtype: M2D_EClientErrorSubtypes.MessageInvalid,
			data: {
				type: M2D_EClientMessageInvalidErrorTypes.NotStartingWithPrefix,
				message: messageContent
			}
		} as M2D_IClientMessageInvalidError);
	}),
	executeMessageCommand: (parsedMessage: M2D_IClientParsedMessage, suppParameters: M2D_ICommandSuppParameters) => new Promise<void>((res, rej) => {
		let command: M2D_ICommand | null = null;
		
		M2D_LogUtils.logMessage(`info`, `Sprawdzanie dostępności komendy "${parsedMessage.keyword}"...`)
			.then(() => M2D_CommandUtils.getCommand(parsedMessage.keyword)
				.then((cmd: M2D_ICommand) => M2D_LogUtils.logMessage(`success`, `Znaleziono komendę "${cmd.name}"!`)
					.then(() => command = cmd)
				)
				.catch(() => M2D_LogUtils.logMessage(`warn`, `Nie znaleziono komendy "${parsedMessage.keyword}". Szukanie pasującego aliasu...`)
						.then(() => M2D_CommandUtils.getCommandFromAlias(parsedMessage.keyword)
							.then((cmd: M2D_ICommand) => M2D_LogUtils.logMessage(`success`, `Znaleziono komendę "${cmd.name}" według aliasu "${parsedMessage.keyword}"!`)
								.then(() => command = cmd)
							)
							.catch(() => M2D_LogUtils.logMessage(`error`, `"${parsedMessage.keyword}" nie odnosi się ani do komendy, ani do aliasu!`))
					)
				)
			)
			.then(() => {
				if(command) {
					if(command.active) {
						if(command.chatInvokable) {
							M2D_GeneralUtils.isDevModeEnabled()
								.then((val) => {
									if(!(command as M2D_ICommand).developerOnly || ((command as M2D_ICommand).developerOnly && val)) {
										command = command as M2D_ICommand;
										const { fullCommand, keyword, parameters } = parsedMessage;

										M2D_CommandUtils.buildCommandParameters(command, parameters)
											.then((params: M2D_ICommandParameter[]) => {
												M2D_CommandUtils.invokeCommand(command as M2D_ICommand, params, suppParameters)
													.then(() => res())
													.catch((err) => rej(err));
											})
											.catch((err: M2D_ICommandsInsufficientParametersError) => M2D_LogUtils.logMultipleMessages(`error`, `Podano nieprawidłową ilość parametrów do komendy "${(command as M2D_ICommand).name}"`, `Minimalna ilość parametrów: ${err.data.requiredParametersCount}`, `Maksymalna ilość parametrów: ${err.data.allParametersCount}`, `Otrzymana ilość parametrów: ${err.data.receivedParametersCount}`)
												.then(() => rej(err as M2D_ICommandsInsufficientParametersError))
											)
									} else M2D_LogUtils.logMessage(`error`, `Komenda "${(command as M2D_ICommand).name}" jest komendą deweloperską, a tryb deweloperski został wyłączony!`)
										.then(() => rej({
											type: M2D_EErrorTypes.Commands,
											subtype: M2D_ECommandsErrorSubtypes.CommandDeveloperOnly,
											data: {
												commandName: (command as M2D_ICommand).name
											}
										} as M2D_ICommandsCommandDeveloperOnlyError))
								});
						} else M2D_LogUtils.logMessage(`error`, `Komendy "${command.name}" nie można wywoływać poprzez wiadomość!`)
							.then(() => rej({
								type: M2D_EErrorTypes.Commands,
								subtype: M2D_ECommandsErrorSubtypes.CommandNotInvokableInChat,
								data: {
									commandName: (command as M2D_ICommand).name
								}
							} as M2D_ICommandsCommandNotInvokableInChatError));
					} else M2D_LogUtils.logMessage(`error`, `Komenda "${command.name}" została zdezaktywowana!`)
						.then(() => rej({
							type: M2D_EErrorTypes.Commands,
							subtype: M2D_ECommandsErrorSubtypes.CommandNotActive,
							data: {
								commandName: (command as M2D_ICommand).name
							}
						} as M2D_ICommandsCommandNotActiveError));
				} else rej({
					type: M2D_EErrorTypes.Commands,
					subtype: M2D_ECommandsErrorSubtypes.MissingCommand,
					data: {
						commandName: parsedMessage.keyword
					}
				} as M2D_ICommandsMissingCommandError);
			});
	}),
	doesGuildExist: (guildId: string) => M2D_Client.guilds.cache.get(guildId) !== undefined,
	doesChannelExist: (channelId: string) => M2D_Client.channels.cache.get(channelId) !== undefined,
	doesChannelOnGuildExist: (guildId: string, channelId: string) => {
		if(M2D_ClientUtils.doesGuildExist(guildId)) {
			const guild = M2D_Client.guilds.cache.get(guildId) as Guild;

			if(guild.channels.cache.get(channelId)) return true;
			else return false;
		} else return false;
	},
	doesUserExist: (userId: string) => M2D_Client.users.cache.get(userId) !== undefined,
	getGuildFromId: (guildId: string) => new Promise<Guild>((res, rej) => {
		if(M2D_ClientUtils.doesGuildExist(guildId)) {
			res(M2D_Client.guilds.cache.get(guildId) as Guild);
		} else rej({
			type: M2D_EErrorTypes.Client,
			subtype: M2D_EClientErrorSubtypes.MissingGuild,
			data: {
				guildId
			}
		} as M2D_IClientMissingGuildError);
	}),
	getGuildChannelFromId: (guildId: string, channelId: string) => new Promise<GuildBasedChannel>((res, rej) => {
		if(M2D_ClientUtils.doesChannelOnGuildExist(guildId, channelId)) {
			M2D_ClientUtils.getGuildFromId(guildId)
				.then((guild) => {
					res(guild.channels.cache.get(channelId) as GuildBasedChannel);
				});	
		} else rej({
			type: M2D_EErrorTypes.Client,
			subtype: M2D_EClientErrorSubtypes.MissingGuildChannel,
			data: {
				guildId,
				channelId
			}
		} as M2D_IClientMissingGuildChannelError);
	})
};

//#region Exports
	export type {
		M2D_IClientDiscordAPIError,
		M2D_IClientMessageInvalidError,
		M2D_IClientMissingGuildError,
		M2D_IClientMissingChannelError,
		M2D_IClientMissingGuildChannelError,
		M2D_IClientMissingUserError,
		M2D_IClientInsufficientPermissionsError,
		M2D_ClientError
	};
	export {
		M2D_EClientErrorSubtypes,
		M2D_ClientUtils
	};
//#endregion