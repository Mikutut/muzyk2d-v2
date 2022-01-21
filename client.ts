//#region Imports
	import { M2D_ConfigUtils } from "./config";
	import { Client, Guild, Channel, GuildMember, User, Intents, Message, TextChannel, DMChannel, GuildBasedChannel, PermissionFlags, MessageOptions, TextBasedChannel, ThreadChannel, VoiceState, VoiceChannel } from "discord.js";
	import { M2D_LogUtils } from "./log";
	import { M2D_EErrorTypes, M2D_EGeneralErrorSubtypes, M2D_Error, M2D_GeneralUtils, M2D_IError, M2D_IGeneralDevModeUserNotAllowedError, M2D_IUnknownError } from "./utils";
	import { M2D_CommandUtils, M2D_ECommandsErrorSubtypes, M2D_ICommand, M2D_ICommandParameter, M2D_ICommandsCommandDeveloperOnlyError, M2D_ICommandsCommandNotActiveError, M2D_ICommandsCommandNotInvokableInChatError, M2D_ICommandsInsufficientParametersError, M2D_ICommandsMissingCommandError, M2D_ICommandSuppParameters } from "./commands";
	import { M2D_IVoiceConnection, M2D_VoiceUtils } from "./voice";
	import { M2D_YTAPIUtils } from "./youtubeapi";
	import { M2D_PlaylistUtils } from "./playlist";
	import { M2D_PlaybackUtils } from "./playback";
	import { M2D_MessagesUtils } from "./messages";
	import * as fs from "fs/promises";
	import { M2D_Events } from "./events";
	import { M2D_StatusUtils } from "./status";
//#endregion

//#region Types
	interface M2D_IClientParsedMessage {
		fullCommand: string;
		keyword: string;
		parameters: string[];
	};
	interface M2D_IClientParsedParameter {
		position: number;
		parameter: string;
	}
	interface M2D_IClientLastUsedChannel {
		guildId: string;
		channelId: string;
	};
	//#region Error types
		const enum M2D_EClientErrorSubtypes {
			DiscordAPI = "DISCORD_API",
			MessageInvalid = "MESSAGE_INVALID",
			MissingGuild = "MISSING_GUILD",
			MissingChannel = "MISSING_CHANNEL",
			MissingGuildChannel = "MISSING_GUILD_CHANNEL",
			MissingUser = "MISSING_USER",
			MissingGuildMember = "MISSING_GUILD_MEMBER",
			InsufficientPermissions = "INSUFFICIENT_PERMISSIONS",
			WrongChannelType = "WRONG_CHANNEL_TYPE",
			LastUsedChannelNotFound = "LAST_USED_CHANNEL_NOT_FOUND",
			Filesystem = "FILESYSTEM"
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
		interface M2D_IClientMissingGuildMemberError extends M2D_IError {
			data: {
				guildId: string;
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
		interface M2D_IClientWrongChannelTypeError extends M2D_IError {
			data: {
				guildId: string;
				channelId: string;
				expectedTypes: string[];
				receivedType: string;
			}
		};
		interface M2D_IClientLastUsedChannelNotFoundError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IClientFilesystemError extends M2D_IError {
			data: {
				errorMessage: string;
				path: string;
			}
		};

		type M2D_ClientError = M2D_IClientDiscordAPIError |
			M2D_IClientMessageInvalidError |
			M2D_IClientMissingGuildError |
			M2D_IClientMissingChannelError |
			M2D_IClientMissingGuildChannelError |
			M2D_IClientMissingUserError |
			M2D_IClientMissingGuildMemberError |
			M2D_IClientInsufficientPermissionsError |
			M2D_IClientWrongChannelTypeError |
			M2D_IClientLastUsedChannelNotFoundError |
			M2D_IClientFilesystemError;
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

const M2D_CLIENT_LAST_USED_CHANNELS: M2D_IClientLastUsedChannel[] = [];

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
		M2D_Client.on("ready", async () => {
			console.log(`Rozpoczęto wstępną inicjalizację...`);
			await M2D_GeneralUtils.initGeneralCapabilities()
				.then(() => M2D_LogUtils.initLogCapabilities())
				.then(() => M2D_CommandUtils.initCommandCapabilities())
				.then(() => M2D_ConfigUtils.initConfigCapabilities())
				.then(() => M2D_ClientUtils.initClientCapabilities())
				.then(() => M2D_VoiceUtils.initVoiceCapabilities())
				.then(() => M2D_PlaylistUtils.initPlaylistCapabilities())
				.then(() => M2D_PlaybackUtils.initPlaybackCapabilities())
				.then(() => M2D_YTAPIUtils.initYTAPICapabilities())
				.then(() => M2D_StatusUtils.initStatusCapabilities())
				.then(() => M2D_GeneralUtils.ignoreError(
					M2D_ConfigUtils.getConfigValue("sendMessageOnStartup")
						.then((val: string) => {
							if(val === "true") {
								return M2D_GeneralUtils.sendStartupMessage(true);
							} else return Promise.resolve();
						})
				))
				.then(() => {
					M2D_LogUtils.logMessage("success", `Muzyk2D (v${M2D_GeneralUtils.getMuzyk2DVersion()}) - gotowy do działania!`);
				})
				.catch((err: M2D_Error) => {
					M2D_LogUtils.logMultipleMessages("error", [`Wystąpił błąd podczas wstępnej inicjalizacji!`, `Oznaczenie błędu: ${M2D_GeneralUtils.getErrorString(err)}`, `Informacje o błędzie: "${JSON.stringify(err.data)}"`, `Muzyk2D przejdzie do samowyłączenia.`])
						.then(() => M2D_GeneralUtils.exitHandler(1));
				})
		});
		M2D_Client.on("messageCreate", async (message: Message) => {
			try {
				if(message.author.id !== M2D_Client.user?.id) {
					await M2D_LogUtils.logMultipleMessages(`info`, [`Odebrano nową wiadomość:`, `Treść: "${message.content}"`, `Serwer: "${message.guild?.name}" (${message.guild?.id})`, `Użytkownik: "${message.guild?.members.cache.get(message.author.id)?.nickname}" ("${message.author.tag}")`]);
				}

				const guild = message.guild;

				if(guild) {
					const guildId = guild.id;

					await M2D_ConfigUtils.getConfigValue("prefix", guildId)
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
											.catch((err: M2D_Error) => M2D_MessagesUtils.getMessage("clientInvokingCommandError", [ parsedMessage.fullCommand, M2D_GeneralUtils.getErrorString(err), JSON.stringify(err.data) ])
												.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
													embeds: [
														msg	
													]
												}))
											)
											.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, [ `Wystąpił błąd podczas wysyłania wiadomości zwrotnej o błędzie!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"` ]));
									})
								)
								.catch(() => {return;})
						)
						.catch((error: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas interpretowania wiadomości!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(error)}"`, `Dane o błędzie: "${JSON.stringify(error.data)}"`]));
				} else throw new Error("Guild was null");
			} catch(err) {
				M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił nieznany błąd podczas interpretowania wiadomości!`, `Tekst błędu: "${(err as Error).message}"`]);
			}
		});
		M2D_Client.on("invalidated", async () => {
			await M2D_LogUtils.logMessage(`error`, `Sesja klienta została unieważniona! Przechodzenie do wyłączenia...`)
				.then(() => M2D_GeneralUtils.exitHandler(2));
		});
		M2D_Client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
			await M2D_GeneralUtils.ignoreError(
				M2D_VoiceUtils.getVoiceConnection(newState.guild.id)
				.then((vc: M2D_IVoiceConnection) => M2D_ClientUtils.getGuildChannelFromId(vc.guildId, vc.channelId)
					.then((ch: GuildBasedChannel) => {
						if(ch.type === "GUILD_VOICE") {
							return ch as VoiceChannel;
						} else return Promise.reject({
							type: M2D_EErrorTypes.Client,
							subtype: M2D_EClientErrorSubtypes.WrongChannelType,
							data: {
								guildId: vc.guildId,
								channelId: vc.channelId,
								expectedTypes: ["GUILD_VOICE"],
								receivedType: ch.type
							}
						} as M2D_IClientWrongChannelTypeError);
					})
					.then((ch: VoiceChannel) => {
						if(ch.members.size !== vc.channelMembersCount) {
							vc.channelMembersCount = ch.members.size;
							M2D_Events.emit("voiceMembersCountChanged", vc.guildId);
						}
					})
					.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${newState.guild.id}" - nie udało się uzyskać stanu połączenia głosowego!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`]))
				)
			);
		});
		M2D_Client.on("guildDelete", async (guild: Guild) => {
			await M2D_LogUtils.logMultipleMessages(`info`, [`GID: "${guild.id}" - serwer ("${guild.name}") został usunięty albo klient został z niego wyrzucony`, `Usuwanie wszelkich lokalnych zmianek o nim...`])
				.then(() => M2D_LogUtils.logMessage(`info`, `Usuwanie wpisów w konfiguracji dla serwera "${guild.id}"...`)
					.then(() => M2D_ConfigUtils.deleteConfigOverridesOnGuild(guild.id))
				)
				.then(() => M2D_LogUtils.logMessage(`info`, `Usuwanie ostatnio używanych kanałów na serwerze "${guild.id}"...`)
					.then(() => M2D_ClientUtils.deleteLastUsedChannelsOnGuild(guild.id))
				)
				.then(() => M2D_LogUtils.logMessage(`info`, `Usuwanie zapamiętanych połączeń głosowych na serwerze "${guild.id}"...`)
					.then(() => M2D_GeneralUtils.ignoreError(
						M2D_VoiceUtils.getVoiceConnection(guild.id)
							.then(() => M2D_VoiceUtils.destroyVoiceConnection(guild.id))	
					))
				)
				.then(() => M2D_LogUtils.logMessage(`info`, `Usuwanie odtworzeń na serwerze "${guild.id}"...`)
					.then(() => M2D_GeneralUtils.ignoreError(
						M2D_PlaybackUtils.getPlayback(guild.id)
							.then(() => M2D_PlaybackUtils.destroyPlayback(guild.id))	
					))
				)
				.then(() => M2D_LogUtils.logMessage(`info`, `Usuwanie playlisty serwera "${guild.id}"...`)
					.then(() => M2D_PlaylistUtils.deletePlaylist(guild.id))
				)
				.then(() => M2D_LogUtils.logMessage(`info`, `Aktualizowanie listy serwerów w Rich Presence...`)
          .then(() => M2D_StatusUtils.updateStatusMessage())
				)
				.then(() => M2D_LogUtils.logMessage(`info`, `Operacja usuwania wzmianek o serwerze "${guild.name}" ("${guild.id}") powiodła się!`))	
        .catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [`Nie udało się usunąć w pełni wszystkich zmianek o serwerze "${guild.name}" (${guild.id})`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`]))
		});
	},
	parseMessage: (messageContent: string, prefix: string) => new Promise<M2D_IClientParsedMessage>((res, rej) => {
		if(messageContent.startsWith(prefix)) {
			if(messageContent.length >= `${prefix}`.length) {
				const fullCommand = messageContent.replace(`${prefix}`, "");
				const paramRegex = /(?:[^\s"]+|"[^"]*")+/g;
				const markdownRegex = /^md"(.*)"$/g;

				const keyword = ((fullCommand.match(paramRegex) as RegExpMatchArray) as string[])[0];
				const unparsedParams = (fullCommand.match(paramRegex) as RegExpMatchArray) as string[];
				unparsedParams.shift();

				let outputParams: string[] = [];

				if(unparsedParams.length > 0) {
					const params: M2D_IClientParsedParameter[] = unparsedParams.map((v, i) => { return { position: i, parameter: v }; });

					let outputMarkdownParams: M2D_IClientParsedParameter[] = [];
					let outputNormalParams: M2D_IClientParsedParameter[] = [];

					for(const v of params) {
						const isMarkdown = (v.parameter).match(markdownRegex);
						if(isMarkdown) {
							outputMarkdownParams.push(v);
						} else {
							outputNormalParams.push(v);
						}
					}

					outputMarkdownParams = outputMarkdownParams
						.map((v) => { 
							const exec = markdownRegex.exec(v.parameter);
							return { position: v.position, parameter: `\`\`\`md\n${((exec as RegExpExecArray)[1]).replaceAll("\\n", "\n")}\n\`\`\`` }; 
						});

					outputNormalParams = outputNormalParams.map((v) => { return { position: v.position, parameter: ((v.parameter.replace(/^"/, "")).replace(/"$/, "")).replaceAll("\\n", "\n") } });


					if((outputMarkdownParams.concat(outputNormalParams)).length > 0) {
						outputParams = (outputMarkdownParams.concat(outputNormalParams)
							.sort((a, b) => a.position - b.position))
							.map((v) => v.parameter);
					}
				}

				res({
					fullCommand,
					keyword,
					parameters: outputParams
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
									if((command as M2D_ICommand).developerOnly && !val) {
										M2D_LogUtils.logMessage(`error`, `Komenda "${(command as M2D_ICommand).name}" jest komendą deweloperską, a tryb deweloperski został wyłączony!`)
											.then(() => rej({
												type: M2D_EErrorTypes.Commands,
												subtype: M2D_ECommandsErrorSubtypes.CommandDeveloperOnly,
												data: {
													commandName: (command as M2D_ICommand).name
												}
											} as M2D_ICommandsCommandDeveloperOnlyError));
									} else if((command as M2D_ICommand).developerOnly && val && !M2D_GeneralUtils.isUserDevModeAllowed(suppParameters.user.id)) {
										M2D_LogUtils.logMessage(`error`, `Komenda "${(command as M2D_ICommand).name}" jest komendą deweloperską i wystąpiła próba jej wykonania przez nieautoryzowaną osobę ("${suppParameters.user.tag}" - ${suppParameters.user.id})`)
											.then(() => rej({
												type: M2D_EErrorTypes.General,
												subtype: M2D_EGeneralErrorSubtypes.DevModeUserNotAllowed,
												data: {
													userId: suppParameters.user.id
												}
											} as M2D_IGeneralDevModeUserNotAllowedError));
									} else {
										if(!(command as M2D_ICommand).isUtilCommand || ((command as M2D_ICommand).isUtilCommand && M2D_GeneralUtils.isUserDevModeAllowed(suppParameters.user.id))) {
											command = command as M2D_ICommand;
											const { fullCommand, keyword, parameters } = parsedMessage;

											M2D_CommandUtils.buildCommandParameters(command, parameters)
												.then((params: M2D_ICommandParameter[]) => {
													M2D_CommandUtils.invokeCommand(command as M2D_ICommand, params, suppParameters)
														.then(() => res())
														.catch((err) => rej(err));
												})
												.catch((err: M2D_ICommandsInsufficientParametersError) => M2D_LogUtils.logMultipleMessages(`error`, [`Podano nieprawidłową ilość parametrów do komendy "${(command as M2D_ICommand).name}"`, `Minimalna ilość parametrów: ${err.data.requiredParametersCount}`, `Maksymalna ilość parametrów: ${err.data.allParametersCount}`, `Otrzymana ilość parametrów: ${err.data.receivedParametersCount}`])
													.then(() => rej(err as M2D_ICommandsInsufficientParametersError))
												);
										} else M2D_LogUtils.logMessage(`error`, `Komenda "${(command as M2D_ICommand).name}" jest komendą użytkową, a użytkownik nie należy do grupy dozwolonych`)
											.then(() => rej({
												type: M2D_EErrorTypes.General,
												subtype: M2D_EGeneralErrorSubtypes.DevModeUserNotAllowed,
												data: {
													userId: suppParameters.user.id
												}
											} as M2D_IGeneralDevModeUserNotAllowedError));
									}
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
	doesUserOnGuildExist: (guildId: string, userId: string) => {
		if(M2D_ClientUtils.doesGuildExist(guildId)) {
			const guild = M2D_Client.guilds.cache.get(guildId) as Guild;

			if(guild.members.cache.find((v) => v.user.id === userId)) return true;
		} else return false;
	},
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
	}),
	getUserFromId: (userId: string) => new Promise<User>((res, rej) => {
		if(M2D_ClientUtils.doesUserExist(userId)) {
			res(M2D_Client.users.cache.get(userId) as User);
		} else rej({
			type: M2D_EErrorTypes.Client,
			subtype: M2D_EClientErrorSubtypes.MissingUser,
			data: {
				userId
			}
		} as M2D_IClientMissingUserError);
	}),
	getGuildMemberFromId: (guildId: string, userId: string) => new Promise<GuildMember>((res, rej) => {
		M2D_ClientUtils.getGuildFromId(guildId)
			.then((guild) => {
				if(M2D_ClientUtils.doesUserOnGuildExist(guildId, userId)) {
					res(guild.members.cache.find((v) => v.user.id === userId) as GuildMember);
				} else rej({
					type: M2D_EErrorTypes.Client,
					subtype: M2D_EClientErrorSubtypes.MissingGuildMember,
					data: {
						guildId,
						userId
					}
				} as M2D_IClientMissingGuildMemberError);
			})
			.catch((err) => rej(err));	
	}),
	sendMessageInGuild: (guildId: string, channelId: string | undefined, message: MessageOptions, deleteMsg?: boolean) => new Promise<void>((res, rej) => {
		M2D_ConfigUtils.getConfigValue("autoDeleteMessageReplies", guildId)
			.then((val) => {
				const autoDeleteMessageReplies = (val === "true") ? true : false;

				M2D_ConfigUtils.getConfigValue("autoDeleteMessageRepliesTime", guildId)
					.then((val2) => {
						const autoDeleteMessageRepliesTime = parseInt(val2, 10);

						if(channelId) {
							M2D_ClientUtils.getGuildChannelFromId(guildId, channelId)
								.then((channel: GuildBasedChannel) => {
									if(channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD") {
										if(channel.permissionsFor(channel.guild.me as GuildMember).has([
											"SEND_MESSAGES",
											"SEND_MESSAGES_IN_THREADS",
										])) {
											channel.sendTyping()
												.then(() => channel.send(message)
													.then((msg: Message<boolean>) => {
														M2D_ClientUtils.setLastUsedChannel(guildId, channelId)	
															.then(() => {
																if(autoDeleteMessageReplies || deleteMsg) {
																	M2D_GeneralUtils.delay(autoDeleteMessageRepliesTime * 1000)
																		.then(() => M2D_LogUtils.logMessage(`info`, `Usuwanie odpowiedzi...`))
																		.then(() => msg.delete())
																		.then(() => M2D_LogUtils.logMessage(`success`, `Usunięto odpowiedź!`))
																		.catch((err: Error) => M2D_LogUtils.logMultipleMessages(`error`, [ `Nie udało się usunąć odpowiedzi!`, `Treść błędu: "${err.message}"` ]));
																	res();
																} else res();
															})
															.catch((err) => rej(err));
													})
													.catch((err: Error) => rej({
														type: M2D_EErrorTypes.Client,
														subtype: M2D_EClientErrorSubtypes.DiscordAPI,
														data: {
															errorMessage: err.message
														}
													} as M2D_IClientDiscordAPIError))
												)
												.catch((err: Error) => rej({
													type: M2D_EErrorTypes.Client,
													subtype: M2D_EClientErrorSubtypes.DiscordAPI,
													data: {
														errorMessage: err.message
													}
												} as M2D_IClientDiscordAPIError));
										} else rej({
											type: M2D_EErrorTypes.Client,
											subtype: M2D_EClientErrorSubtypes.InsufficientPermissions,
											data: {
												guild: channel.guild,
												channel,
												permissions: [ "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS" ]
											}
										} as M2D_IClientInsufficientPermissionsError);
									} else rej({
										type: M2D_EErrorTypes.Client,
										subtype: M2D_EClientErrorSubtypes.WrongChannelType,
										data: {
											guildId,
											channelId,
											expectedTypes: ["GUILD_TEXT", "GUILD_PUBLIC_THREAD"],
											receivedType: channel.type
										}
									} as M2D_IClientWrongChannelTypeError); 
								})
								.catch((err) => rej(err));	
						} else M2D_ConfigUtils.getConfigValue("sendMessageDefaultChannel", guildId)
							.then((val3) => M2D_ClientUtils.getGuildChannelFromId(guildId, val3)
								.then((ch: GuildBasedChannel) => {
									if(ch.type === "GUILD_TEXT") {
										return ch as TextChannel;
									} else if(ch.type === "GUILD_PUBLIC_THREAD") {
										return ch as ThreadChannel;
									} else return Promise.reject({
										type: M2D_EErrorTypes.Client,
										subtype: M2D_EClientErrorSubtypes.WrongChannelType,
										data: {
											guildId,
											channelId: ch.id,
											expectedTypes: ["GUILD_TEXT", "GUILD_PUBLIC_THREAD"],
											receivedType: ch.type
										}
									} as M2D_IClientWrongChannelTypeError);
								})
								.catch((err) => Promise.reject(err))
							)
							.then((channel: TextChannel | ThreadChannel) => M2D_ClientUtils.setLastUsedChannel(guildId, channel.id)
								.then(() => channel)
							)
							.catch(() => M2D_ClientUtils.getLastUsedChannel(guildId)
								.then((ch) => Promise.resolve(ch))
								.catch((err) => Promise.reject(err))
							)
							.then((channel: TextChannel | ThreadChannel) => {
								if(channel.permissionsFor(channel.guild.me as GuildMember).has([
									"SEND_MESSAGES",
									"SEND_MESSAGES_IN_THREADS",
								])) {
									return channel.sendTyping()
										.then(() => channel.send(message)
											.then((msg: Message<boolean>) => {
												if(autoDeleteMessageReplies || deleteMsg) {
													M2D_GeneralUtils.delay(autoDeleteMessageRepliesTime * 1000)
														.then(() => M2D_LogUtils.logMessage(`info`, `Usuwanie odpowiedzi...`))
														.then(() => msg.delete())
														.then(() => M2D_LogUtils.logMessage(`success`, `Usunięto odpowiedź!`))
														.catch((err: Error) => M2D_LogUtils.logMultipleMessages(`error`, [ `Nie udało się usunąć odpowiedzi!`, `Treść błędu: "${err.message}"` ]));
													res();
												} else res();
											})
											.catch((err: Error) => Promise.reject({
												type: M2D_EErrorTypes.Client,
												subtype: M2D_EClientErrorSubtypes.DiscordAPI,
												data: {
													errorMessage: err.message
												}
											} as M2D_IClientDiscordAPIError))
										)
										.catch((err: Error) => Promise.reject({
											type: M2D_EErrorTypes.Client,
											subtype: M2D_EClientErrorSubtypes.DiscordAPI,
											data: {
												errorMessage: err.message
											}
										} as M2D_IClientDiscordAPIError));
								} else return Promise.reject({
									type: M2D_EErrorTypes.Client,
									subtype: M2D_EClientErrorSubtypes.InsufficientPermissions,
									data: {
										guild: channel.guild,
										channel,
										permissions: [ "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS" ]
									}
								} as M2D_IClientInsufficientPermissionsError);
							})
							.catch((err) => rej(err));
					})
					.catch((err) => rej(err));
			})
			.catch((err) => rej(err));	
	}),
	sendMessageReplyInGuild: (orgMessage: Message<boolean>, message: MessageOptions, deleteMsg?: boolean) => new Promise<void>((res, rej) => {
		const channel = orgMessage.channel;
		const guild = orgMessage.guild as Guild;

		M2D_ConfigUtils.getConfigValue("autoDeleteMessageReplies", guild.id)
			.then((val) => {
				const autoDeleteMessageReplies = (val === "true") ? true : false;

				M2D_ConfigUtils.getConfigValue("autoDeleteMessageRepliesTime", guild.id)
					.then((val2) => {
						const autoDeleteMessageRepliesTime = parseInt(val2, 10);
						
						if(channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD") {
							if(channel.permissionsFor(guild.me as GuildMember).has([
								"SEND_MESSAGES",
								"SEND_MESSAGES_IN_THREADS",
								"USE_PUBLIC_THREADS",
							])) {
								channel.sendTyping()
									.then(() => orgMessage.reply(message)
										.then((msg: Message<boolean>) => {
											M2D_ClientUtils.setLastUsedChannel(guild.id, channel.id)
												.then(() => {
													if(autoDeleteMessageReplies || deleteMsg) {
														M2D_GeneralUtils.delay(autoDeleteMessageRepliesTime * 1000)
															.then(() => M2D_LogUtils.logMessage(`info`, `Usuwanie odpowiedzi...`))
															.then(() => msg.delete())
															.then(() => M2D_LogUtils.logMessage(`success`, `Usunięto odpowiedź!`))
															.catch((err: Error) => M2D_LogUtils.logMultipleMessages(`error`, [ `Nie udało się usunąć odpowiedzi!`, `Treść błędu: "${err.message}"` ]));
														res();
													} else {
														res();
													}
												})
												.catch((err) => rej(err));
										})
									)
									.catch((err: Error) => rej({
										type: M2D_EErrorTypes.Client,
										subtype: M2D_EClientErrorSubtypes.DiscordAPI,
										data: {
											errorMessage: err.message
										}
									} as M2D_IClientDiscordAPIError));
							} else rej({
								type: M2D_EErrorTypes.Client,
								subtype: M2D_EClientErrorSubtypes.InsufficientPermissions,
								data: {
									guild,
									channel,
									permissions: [ "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS", "USE_PUBLIC_THREADS" ]
								}
							} as M2D_IClientInsufficientPermissionsError);
						} else rej({
							type: M2D_EErrorTypes.Client,
							subtype: M2D_EClientErrorSubtypes.WrongChannelType,
							data: {
								guildId: guild.id,
								channelId: channel.id,
								expectedTypes: ["GUILD_TEXT", "GUILD_PUBLIC_THREAD"],
								receivedType: channel.type
							}
						} as M2D_IClientWrongChannelTypeError); 
					})	
					.catch((err) => rej(err));
			})
			.catch((err) => rej(err));
	}),
	doesLastUsedChannelExist: (guildId: string) => new Promise<boolean>((res, rej) => {
		if(M2D_CLIENT_LAST_USED_CHANNELS.find((v) => v.guildId === guildId) !== undefined) {
			const lCh = M2D_CLIENT_LAST_USED_CHANNELS.find((v) => v.guildId === guildId) as M2D_IClientLastUsedChannel;

			M2D_ClientUtils.getGuildChannelFromId(guildId, lCh.channelId)
				.then(() => res(true))
				.catch(() => res(false)); 
		} else res(false);
	}),
	setLastUsedChannel: (guildId: string, channelId: string) => new Promise<void>((res, rej) => {
		const lCh = M2D_CLIENT_LAST_USED_CHANNELS.find((v) => v.guildId === guildId);

		if(lCh) {
			const idx = M2D_CLIENT_LAST_USED_CHANNELS.findIndex((v) => v.guildId === guildId);

			M2D_CLIENT_LAST_USED_CHANNELS[idx].channelId = channelId;
		} else {
			M2D_CLIENT_LAST_USED_CHANNELS.push({
				guildId,
				channelId
			});
		}
		res();
	}),
	deleteLastUsedChannelsOnGuild: (guildId: string) => new Promise<void>((res, rej) => {
		for(const [i, v] of M2D_CLIENT_LAST_USED_CHANNELS.entries()) {
			if(v.guildId === guildId) {
				M2D_CLIENT_LAST_USED_CHANNELS.splice(i, 1);
			}
		}
		res();
	}),
	deleteLastUsedChannel: (guildId: string, channelId: string) => new Promise<void>((res, rej) => {
		const lCh = M2D_CLIENT_LAST_USED_CHANNELS.find((v) => v.guildId === guildId);

		if(lCh) {
			const idx = M2D_CLIENT_LAST_USED_CHANNELS.findIndex((v) => v.guildId === guildId);

			M2D_CLIENT_LAST_USED_CHANNELS.splice(idx, 1);
			res();
		} else rej({
			type: M2D_EErrorTypes.Client,
			subtype: M2D_EClientErrorSubtypes.LastUsedChannelNotFound,
			data: {
				guildId
			}
		} as M2D_IClientLastUsedChannelNotFoundError);
	}),
	getLastUsedChannel: (guildId: string) => new Promise<TextChannel | ThreadChannel>((res, rej) => {
		M2D_ClientUtils.doesLastUsedChannelExist(guildId)
			.then((doesExist) => {
				if(doesExist) {
					const lCh = M2D_CLIENT_LAST_USED_CHANNELS.find((v) => v.guildId === guildId) as M2D_IClientLastUsedChannel;

					return M2D_ClientUtils.getGuildChannelFromId(guildId, lCh.channelId);
				} else return Promise.reject({
					type: M2D_EErrorTypes.Client,
					subtype: M2D_EClientErrorSubtypes.LastUsedChannelNotFound,
					data: {
						guildId
					}
				} as M2D_IClientLastUsedChannelNotFoundError);
			})
			.then((ch: GuildBasedChannel) => {
				if(ch.type === "GUILD_TEXT") {
					res(ch as TextChannel);
				} else if(ch.type === "GUILD_PUBLIC_THREAD") {
					res(ch as ThreadChannel);
				} else rej({
					type: M2D_EErrorTypes.Client,
					subtype: M2D_EClientErrorSubtypes.WrongChannelType,
					data: {
						guildId,
						channelId: ch.id,
						expectedTypes: ["GUILD_TEXT", "GUILD_PUBLIC_THREAD"],
						receivedType: ch.type
					}
				} as M2D_IClientWrongChannelTypeError);
			})
			.catch((err) => rej(err));
	}),
	getLastUsedChannels: () => [ ...M2D_CLIENT_LAST_USED_CHANNELS ],
	initClientCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie możliwości klienta...`)
			.then(() => M2D_LogUtils.logMessage(`info`, `Wczytywanie ostatnio używanych kanałów z pliku...`))
			.then(() => fs.readFile("m2d_lastusedchannels.json", { encoding: "utf-8" })
				.then((data: string) => {
					M2D_CLIENT_LAST_USED_CHANNELS.push(...JSON.parse(data));
					return M2D_LogUtils.logMessage(`success`, `Wczytano ostatnio używane kanały z pliku!`);
				})
				.catch((err: Error) => M2D_LogUtils.logMultipleMessages(`error`, [`Nie udało się wczytać ostatnio używanych kanałów z pliku!`, `Treść błędu: "${err.message}"`]))
			)
			.then(() => M2D_LogUtils.logMessage(`success`, `Zainicjalizowano możliwości klienta!`)
				.then(() => res())
			)
			.catch((err) => rej(err));	
	}),
	clientExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wyłączanie klienta...`)
			.then(() => M2D_LogUtils.logMessage(`info`, `Zapisywanie ostatnio używanych kanałów do pliku...`))
			.then(() => fs.writeFile("m2d_lastusedchannels.json", JSON.stringify(M2D_CLIENT_LAST_USED_CHANNELS), { encoding: "utf-8" })
				.catch((err: Error) => M2D_LogUtils.logMultipleMessages(`error`, [`Nie udało się zapisać ostatnio używanych kanałów do pliku!`, `Treść błędu: "${err.message}"`])
					.then(() => Promise.reject({
						type: M2D_EErrorTypes.Client,
						subtype: M2D_EClientErrorSubtypes.Filesystem,
						data: {
							errorMessage: err.message,
							path: "m2d_lastusedchannels.json"
						}
					} as M2D_IClientFilesystemError))
				)
			)
			.then(() => M2D_LogUtils.logMessage(`success`, `Zapisano ostatnio używane kanały do pliku!`))
			.then(() => M2D_LogUtils.logMessage(`success`, `Wyłączono klienta!`))
			.then(() => res())
			.catch((err) => rej(err))
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
		M2D_IClientMissingGuildMemberError,
		M2D_IClientInsufficientPermissionsError,
		M2D_IClientWrongChannelTypeError,
		M2D_IClientLastUsedChannelNotFoundError,
		M2D_ClientError
	};
	export {
		M2D_EClientErrorSubtypes,
		M2D_ClientUtils
	};
//#endregion