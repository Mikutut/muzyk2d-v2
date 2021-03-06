//#region Imports
	import { Message, Channel, Guild, User, PartialTextBasedChannel, GuildMember, TextChannel, ThreadChannel, Collection, GuildBasedChannel, TextBasedChannel } from "discord.js";
	import { M2D_LogUtils } from "./log";
	import { M2D_ErrorSubtypes, M2D_IError, M2D_Error, M2D_GeneralUtils, M2D_EErrorTypes, M2D_EGeneralErrorSubtypes } from "./utils";
	import { nanoid } from "nanoid";
	import { M2D_ClientUtils, M2D_IClientMissingGuildChannelMessageError, M2D_EClientErrorSubtypes, M2D_ClientError, M2D_IClientDiscordAPIError } from "./client";
	import { M2D_ConfigUtils } from "./config";
	import { M2D_MessagesUtils } from "./messages";
//#endregion

//#region Types
	interface M2D_ICommandCategory {
		name: string;
		label: string;
	}
	interface M2D_ICommandParameter {
		name: string;
		value: string;
	}
	interface M2D_ICommandParameterDesc {
		name: string;
		label: string;
		description: string;
		required: boolean;
	}
	interface M2D_ICommandSuppParameters {
		message: Message<boolean>;
		guild: Guild;
		channel: TextBasedChannel;
		user: User;
	}
	type M2D_CommandHandler = (cmd: M2D_ICommand, parameters: M2D_ICommandParameter[], suppParameters?: M2D_ICommandSuppParameters) => Promise<void>;
	type M2D_CommandErrorHandler = (error: M2D_Error, cmd: M2D_ICommand, parameters: M2D_ICommandParameter[], suppParameters?: M2D_ICommandSuppParameters) => Promise<void>;
	interface M2D_ICommand {
		name: string;
		category: M2D_ICommandCategory;
		aliases: string[];
		parameters: M2D_ICommandParameterDesc[];
		description: string;
		active: boolean;
		developerOnly: boolean;
		isUtilCommand: boolean;
		chatInvokable: boolean;
		handler: M2D_CommandHandler;
		errorHandler: M2D_CommandErrorHandler;
	};
	//#region Error types
		const enum M2D_ECommandsErrorSubtypes {
			MissingAlias = "MISSING_ALIAS",
			MissingCommand = "MISSING_COMMAND",
			MissingParameter = "MISSING_PARAMETER",
			InsufficientParameters = "INSUFFICIENT_PARAMETERS",
			MissingSuppParameters = "MISSING_SUPPLEMENTARY_PARAMETERS",
			MissingCategory = "MISSING_CATEGORY",
			CommandNotActive = "COMMAND_NOT_ACTIVE",
			CommandDeveloperOnly = "COMMAND_DEVELOPER_ONLY",
			CommandNotInvokableInChat = "COMMAND_NOT_INVOKABLE_IN_CHAT",
			NoCommandsInCategory = "NO_COMMANDS_IN_CATEGORY",
			DuplicateAliases = "DUPLICATE_ALIASES"
		};
		interface M2D_ICommandsMissingCommandError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsMissingParameterError extends M2D_IError {
			data: {
				parameterName: string;
			}
		};
		interface M2D_ICommandsInsufficientParametersError extends M2D_IError {
			data: {
				commandName: string;
				requiredParametersCount: number;
				allParametersCount: number;
				receivedParametersCount: number;
			}
		};
		interface M2D_ICommandsMissingSuppParametersError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsMissingAliasError extends M2D_IError {
			data: {
				alias: string;
			}
		};
		interface M2D_ICommandsMissingCategoryError extends M2D_IError {
			data: {
				category: string;
			}
		};
		interface M2D_ICommandsCommandDeveloperOnlyError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsCommandNotInvokableInChatError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsNoCommandsInCategoryError extends M2D_IError {
			data: {
				category: M2D_ICommandCategory;
			}
		};
		interface M2D_ICommandsCommandNotActiveError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsDuplicateAliasesError extends M2D_IError {
			data: {
				alias: string;
				commandNames: string[];
			}
		};

		type M2D_CommandsError = M2D_ICommandsMissingCommandError |
			M2D_ICommandsInsufficientParametersError |
			M2D_ICommandsMissingSuppParametersError |
			M2D_ICommandsMissingAliasError |
			M2D_ICommandsMissingCategoryError |
			M2D_ICommandsMissingParameterError | 
			M2D_ICommandsCommandDeveloperOnlyError |
			M2D_ICommandsCommandNotInvokableInChatError |
			M2D_ICommandsNoCommandsInCategoryError |
			M2D_ICommandsCommandNotActiveError |
			M2D_ICommandsDuplicateAliasesError;
	//#endregion
//#endregion

const M2D_CATEGORIES: Record<string, M2D_ICommandCategory> = {
	general: {
		name: "general",
		label: "og??lne"
	},
	config: {
		name: "config",
		label: "konfiguracyjne"
	},
	voice: {
		name: "voice",
		label: "g??osowe"
	},
	playlist: {
		name: "playlist",
		label: "playlista"
	},
	playback: {
		name: "playback",
		label: "odtwarzanie"
	}
};
const M2D_HIDDEN_CATEGORIES: Record<string, M2D_ICommandCategory> = {
	dev: {
		name: "developer",
		label: "deweloperskie"
	},
	chatNonInvokable: {
		name: "chatNonInvokable",
		label: "nieWywo??ywalneNaChacie"
	},
	utility: {
		name: "utility",
		label: "u??ytkowe"
	}
};

const M2D_UTIL_COMMANDS: M2D_ICommand[] = [
	{
		name: "scheduleShutdown",
		aliases: ["ss"],
		category: M2D_HIDDEN_CATEGORIES.utility,
		description: "Sends warning message and shuts down bot after s amount of seconds",
		parameters: [
			{
				name: "exitCode",
				label: "kodWyj??cia",
				description: "Exit code",
				required: true
			},
			{
				name: "s",
				label: "s",
				description: "Amount of seconds, after which bot will be shut down",
				required: true
			},
			{
				name: "reason",
				label: "pow??d",
				description: "Shutdown reason",
				required: false
			}
		],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: true,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			M2D_CommandUtils.getParameterValue(parameters, "s")
				.then((val) => {
					return M2D_CommandUtils.getParameterValue(parameters, "exitCode")
						.then((val2) => M2D_CommandUtils.getParameterValue(parameters, "reason")
							.then((val3) => val3)
							.catch(() => undefined)
							.then((val3) => M2D_GeneralUtils.scheduleShutdown(parseInt(val2, 10), parseInt(val, 10), val3))
						)
						.catch((err) => Promise.reject(err));
				})
				.then(() => res())
				.catch((err) => rej(err));	
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	},
	{
		name: "sendDevMessage",
		aliases: ["sdm"],
		category: M2D_HIDDEN_CATEGORIES.utility,
		description: "Sends developer message",
		parameters: [
			{
				name: "message",
				label: "wiadomo????",
				description: "Message",
				required: true
			},
			{
				name: "guildId",
				label: "idSerwera",
				description: "Guild ID",
				required: false
			},
			{
				name: "channelId",
				label: "idKana??u",
				description: "Channel ID",
				required: false
			}
		],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: true,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			M2D_CommandUtils.getParameterValue(parameters, "message")
				.then((val) => {
					return M2D_CommandUtils.getParameterValue(parameters, "guildId")
						.then((val2) => M2D_CommandUtils.getParameterValue(parameters, "channelId")
							.then((val3) => M2D_GeneralUtils.sendDevMessage(val, val2, val3)
								.then(() => res())
								.catch((err) => rej(err))
							)
							.catch(() => M2D_GeneralUtils.sendDevMessage(val, val2)
								.then(() => res())
								.catch((err) => rej(err))
							)
						)
						.catch(() => M2D_GeneralUtils.sendDevMessage(val)
							.then(() => res())
							.catch((err) => rej(err))
						)
				})
				.catch((err) => rej(err));	
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	},
	{
		name: "everyone",
		aliases: ["ee"],
		category: M2D_HIDDEN_CATEGORIES.utility,
		description: "@everyone prank",
		parameters: [
			{
				name: "shadow",
				label: "shadow",
				description: "Should @everyone be hidden behind spoiler?",
				required: true
			},
			{
				name: "guildId",
				label: "guildId",
				description: "Guild ID",
				required: false
			},
			{
				name: "channelIds",
				label: "channelIds",
				description: "Comma-separated channel IDs",
				required: false
			}
		],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: true,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "shadow")
					.then((shadow: string) => {
						if(shadow === "true") {
							return true;
						} else return false;
					})
					.then((shadow: boolean) => M2D_CommandUtils.getParameterValue(parameters, "guildId")
						.then((guildId) => M2D_CommandUtils.getParameterValue(parameters, "channelIds")
							.then((channelIds) => {
								const splitChannelIds = channelIds.split(",");
								const promisesToHandle: Promise<void>[] = [];
								
								for(const chid of splitChannelIds) {
									promisesToHandle.push(
										M2D_ClientUtils.sendMessageInGuild(guildId, chid, { content: (shadow) ? "||@everyone||" : "@everyone" }, true)
									);
								}

								return Promise.allSettled(promisesToHandle)
									.then(() => M2D_GeneralUtils.ignoreError(M2D_ClientUtils.sendMessageReplyInGuild(message, { content: "Messages sent!" }, true)))
									.catch((err) => rej(err));
							})
							.catch(() => { 
								const g = (M2D_ClientUtils.getClient()).guilds.cache.get(guildId);

								if(g) {
									const channels = g.channels.cache.filter((v) => v.type === "GUILD_TEXT" && v.permissionsFor(g.me as GuildMember).has(["SEND_MESSAGES"])) as Collection<string, TextChannel>;

									if(channels.size > 0) {
										const promisesToHandle: Promise<any>[] = [];
										
										for(const ch of channels) {
											promisesToHandle.push(
												M2D_ClientUtils.sendMessageInGuild(guildId, ch[1].id, { content: (shadow) ? "||@everyone||" : "@everyone" }, true)
											);
										}

										return Promise.allSettled(promisesToHandle)
											.then(() => M2D_GeneralUtils.ignoreError(M2D_ClientUtils.sendMessageReplyInGuild(message, { content: "Messages sent!" }, true)))
											.catch((err) => rej(err));
									} else return M2D_GeneralUtils.ignoreError(M2D_ClientUtils.sendMessageReplyInGuild(message, { content: "Couldn't send messages!" }));
								} else return M2D_GeneralUtils.ignoreError(M2D_ClientUtils.sendMessageReplyInGuild(message, { content: "Couldn't send messages!" }));
							})
						)
						.catch(() => { 
							const guilds = (M2D_ClientUtils.getClient()).guilds.cache;
							const channels: Record<string, Collection<string, TextChannel>> = {};
							const promisesToHandle: Promise<any>[] = [];
							
							guilds.forEach((g) => {
								channels[g.id] = g.channels.cache.filter((v) => v.type === "GUILD_TEXT" && v.permissionsFor(g.me as GuildMember).has(["SEND_MESSAGES"])) as Collection<string, TextChannel>;
							});

							for(const [i, v] of Object.entries(channels)) {
								if(v.size > 0) {
									for(const ch of v) {
										promisesToHandle.push(
											M2D_ClientUtils.sendMessageInGuild(ch[1].guild.id, ch[1].id, { content: "@everyone" }, true)
										);
									}
								}
							}

							return Promise.allSettled(promisesToHandle)
								.then(() => M2D_GeneralUtils.ignoreError(M2D_ClientUtils.sendMessageReplyInGuild(message, { content: "Couldn't send messages!" })).then(() => res()))	
						})
					)
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
		name: "powiedz",
		aliases: ["say", "msg"],
		category: M2D_CATEGORIES.utility,
		description: "Wypowiedz co?? ustami bota",
		parameters: [
			{
				name: "message",
				label: "wiadomo????",
				description: "Wiadomo???? do wypowiedzenia",
				required: true
			},
			{
				name: "channelId",
				label: "idKana??u",
				description: "ID kana??u, na kt??ry wys??a?? wiadomo???? (domy??lnie wykorzystuje kana??, na kt??rym wywo??ano komend??)",
				required: false
			},
			{
				name: "guildId",
				label: "idSerwera",
				description: "ID serwera, na kt??ry wys??a?? wiadomo???? (domy??lnie wykorzystywany jest serwer, na kt??rym wywo??ano komend??)",
				required: false
			}
		],
		active: true,
		developerOnly: false,
		isUtilCommand: true,
		chatInvokable: true,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				const msgChannel = channel;

				M2D_CommandUtils.getParameterValue(parameters, "message")
					.then((msg: string) => M2D_CommandUtils.getParameterValue(parameters, "guildId")
						.then((gId: string) => M2D_ClientUtils.getGuildFromId(gId)
							.then((g: Guild) => g)
							.catch(() => guild)
						)
						.catch(() => guild)
						.then((g: Guild) => M2D_CommandUtils.getParameterValue(parameters, "channelId")
							.then((channelId: string) => M2D_ClientUtils.getGuildChannelFromId(g.id, channelId)
								.then((ch: GuildBasedChannel) => {
									if(ch.isText()) {
										if(ch.type === "GUILD_TEXT") {
											return ch as TextChannel;
										} else if(ch.type === "GUILD_PUBLIC_THREAD") {
											return ch as ThreadChannel;
										}
										else throw new Error();
									}
									else throw new Error();
								})
							)
							.catch(() => msgChannel)
							.then((ch: TextBasedChannel) => M2D_ClientUtils.sendMessageInGuild(g.id, ch.id, { content: msg }, false))
							.then(() => M2D_GeneralUtils.ignoreError(
								message.delete()
							))
							.then(() => res())
							.catch((err) => Promise.reject(err))
						)
					)
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
			switch(M2D_GeneralUtils.getErrorString(error)) {
				default:
					rej(error);	
			}
		})
	},
	{
		name: "odpowiedz",
		aliases: ["odp"],
		description: "Odpowiedz na wiadomo????",
		parameters: [
			{
				name: "messageId",
				label: "idWiadomosci",
				description: "ID wiadomo??ci, na kt??r?? ma zosta?? wys??ana odpowied??",
				required: true
			},
			{
				name: "message",
				label: "wiadomo????",
				description: "Wiadomo????",
				required: true
			},
			{
				name: "channelId",
				label: "idKanalu",
				description: "ID kana??u",
				required: false
			},
			{
				name: "guildId",
				label: "idSerwera",
				description: "ID serwera",
				required: false
			}
		],
		category: M2D_CATEGORIES.utility,
		active: true,
		developerOnly: false,
		isUtilCommand: true,
		chatInvokable: true,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "guildId")
					.then((gId: string) => M2D_ClientUtils.getGuildFromId(gId)
						.then((g: Guild) => g)
						.catch(() => guild)
					)
					.catch(() => guild)
					.then((g: Guild) => M2D_CommandUtils.getParameterValue(parameters, "channelId")
						.then((chId: string) => M2D_ClientUtils.getGuildChannelFromId(g.id, chId)
							.then((ch: GuildBasedChannel) => {
								if(ch.isText()) {
									if(ch.type === "GUILD_TEXT") {
										return ch as TextChannel;
									} else if (ch.type === "GUILD_PUBLIC_THREAD") {
										return ch as ThreadChannel;
									} else throw new Error();
								} else throw new Error();
							})
						)
						.catch(() => channel)
						.then((ch: TextBasedChannel) => M2D_CommandUtils.getParameterValue(parameters, "messageId")
							.then((msgId: string) => ch.messages.fetch(msgId)
								.catch(() => Promise.reject({
									type: M2D_EErrorTypes.Client,
									subtype: M2D_EClientErrorSubtypes.MissingGuildChannelMessage,
									data: {
										guildId: guild.id,
										channelId: ch.id,
										messageId: msgId
									}
								} as M2D_IClientMissingGuildChannelMessageError))
							)
							.then((msg: Message<boolean>) => M2D_CommandUtils.getParameterValue(parameters, "message")
								.then((reply: string) => M2D_ClientUtils.sendMessageReplyInGuild(msg, { content: reply }, false))
								.then(() => M2D_GeneralUtils.ignoreError(
									message.delete()
								))
								.then(() => res())
							)
						)
						.catch((err) => rej(err))
					);

			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			switch(M2D_GeneralUtils.getErrorString(error)) {
				default:
					rej(error);
			}
		})
	},
	{
		name: `leaveServer`,
		aliases: ['ls'],
		category: M2D_HIDDEN_CATEGORIES.utility,
		description: `Opuszcza serwer o podanym ID, w podanym czasie (w sekundach) i z podanego powodu.`,
		parameters: [
			{
				name: `serverId`,
				label: `idSerwera`,
				description: `ID serwera`,
				required: true
			},
			{
				name: `time`,
				label: `czas`,
				description: `Czas, w jaki Muzyk2D opu??ci serwer (w sekundach)`,
				required: true
			},
			{
				name: `reason`,
				label: `pow??d`,
				description: `Pow??d, dla kt??rego Muzyk2D opu??ci serwer`,
				required: false
			}
		],
		active: true,
		developerOnly: false,
		isUtilCommand: true,
		chatInvokable: true,
		handler: (command, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const {message, guild, channel, user} = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "serverId")
					.then((sId) => M2D_CommandUtils.getParameterValue(parameters, "time")
						.then((t) => M2D_CommandUtils.getParameterValue(parameters, "reason")
							.then((r) => r)
							.catch(() => null)
							.then((reason: string | null) => {
								const r = reason ?? "**Nie podano**";
								return M2D_LogUtils.logMultipleMessages(`info`, [ `GID: "${sId}" | ${user.tag} zainicjowa?? wyj??cie z serwera`, `Pow??d: "${r}"` ])
									.then(() => M2D_MessagesUtils.getMessage("clientServerLeave", [ t, r ])
										.then((msg) => M2D_ClientUtils.sendMessageInGuild(sId, undefined, { embeds: [ msg ] }))
										.finally(() => M2D_GeneralUtils.delay(parseInt(t, 10) * 1000))
										.then(() => M2D_ClientUtils.getGuildFromId(sId))
										.then((g) => g.leave()
											.catch((err) => Promise.reject({
												type: M2D_EErrorTypes.Client,
												subtype: M2D_EClientErrorSubtypes.DiscordAPI,
												data: {
													errorMessage: err.message
												}
											} as M2D_IClientDiscordAPIError))
										)
										.then((g) => M2D_LogUtils.logMultipleMessages(`info`, [ `GID: "${g.id}" | Opuszczono "${g.name}"`, `Zainicjowano przez: "${user.tag}"`, `Pow??d: "${r}"` ])
											.then(() => M2D_GeneralUtils.ignoreError(
												M2D_ClientUtils.sendMessageReplyInGuild(message, { content: `Pomy??lnie opuszczono **${g.name} (${g.id})**!` })
											))
										)
									);
							})
						)
					)
					.then(() => res())
					.catch((err) => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: command.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, command, parameters, suppParameters) => new Promise<void>((res, rej) => {
			switch(M2D_GeneralUtils.getErrorString(error)) {
				default: {
					rej(error);
				}
			}
		})
	}
];
const M2D_DEV_COMMANDS: M2D_ICommand[] = [
	{
		name: "isDevMode",
		aliases: ["devmode"],
		category: M2D_HIDDEN_CATEGORIES.dev,
		description: "Wy??wietla status trybu deweloperskiego",
		parameters: [],
		active: true,
		developerOnly: true,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_GeneralUtils.isDevModeEnabled()
					.then((val) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "info",
								description: (val) ? "tak" : "nie"
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
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	}
];
const M2D_CHAT_NON_INVOKABLES: M2D_ICommand[] = [];

const M2D_COMMANDS: M2D_ICommand[] = [
	{
		name: "pomoc",
		category: M2D_CATEGORIES.general,
		aliases: ["h", "help", "tasukete"],
		parameters: [
			{
				name: "category",
				label: "kategoria",
				description: "Kategoria komend, kt??re chcesz wy??wietli??",
				required: false
			}
		],
		description: "Wy??wietla informacje dot. komend",
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_CommandUtils.getParameterValue(parameters, "category")
					.then((val) => M2D_CommandUtils.getCategoryFromNameOrLabel(val)
						.then((cat) => { 
							return M2D_CommandUtils.getCommandsByCategory(cat)
								.then((cmds) => {
									let outputMsg = ``;
									const promisesToHandle: Promise<any>[] = [];

									for(const cmd of cmds) {
										promisesToHandle.push(
											M2D_CommandUtils.buildCommandHelpMessage(cmd, guild.id)
												.then((msg) => { outputMsg = outputMsg.concat(msg); })
												.catch((err) => rej(err))
										);
									}

									return Promise.all(promisesToHandle)
										.then(() => M2D_MessagesUtils.getMessage("commandsHelpShowCommandsFromCategory", [ cat.label, outputMsg ])
												.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
													embeds: [
														msg
													]
												}))
												.then(() => res())
												.catch((err) => Promise.reject(err))
										)
										.catch((err) => rej(err));
								})
								.catch((err: M2D_ICommandsNoCommandsInCategoryError) => rej(err));
						})
						.catch((err: M2D_ICommandsMissingCategoryError) => rej(err))
					)
					.catch(() => {
						M2D_MessagesUtils.getMessage("commandsHelpNoCategoryProvided", [ Object.entries(M2D_CATEGORIES).map(([i, v]) => v.label).join(",\n") ])
							.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
								embeds: [
									msg
								]
							}))	
							.then(() => res())
							.catch((err) => rej(err));	
					});
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError)
		}),
		errorHandler: (error, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	}
];

const M2D_CommandUtils = {
	validateCommands: (commands?: M2D_ICommand[]) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano walidacj?? komend...`)
			.then(() => {
				const checkVector: {aliases: string[]; commandName: string;}[] = [];
				const commandsToCheck: M2D_ICommand[] = (commands) ? commands : M2D_COMMANDS;

				for(const cmd of commandsToCheck) {
					if(checkVector.length === 0) {
						checkVector.push({aliases: cmd.aliases, commandName: cmd.name});
					} else {
						for(const al of cmd.aliases) {
							if(checkVector.find((v) => v.aliases.find((vv) => vv === al))) {
								const conflictingCommands = checkVector.map((v) => {
									if(v.aliases.find((vv) => vv === al)) {
										return v.commandName;
									}
								}) as string[];

								M2D_LogUtils.logMultipleMessages(`error`, [`Wykryto zduplikowane aliasy w li??cie komend!`, `Alias: "${al}"`, `Komendy zawieraj??ce taki alias: "${conflictingCommands.join(", ")}`])
									.then(() => rej({
										type: M2D_EErrorTypes.Commands,
										subtype: M2D_ECommandsErrorSubtypes.DuplicateAliases,
										data: {
											alias: al,
											commandNames: conflictingCommands
										}
									} as M2D_ICommandsDuplicateAliasesError));
							}
						}
					}
				}
				M2D_LogUtils.logMessage(`success`, `Walidacja komend nie wykry??a ??adnych odchyle??!`)
					.then(() => res());
			});	
	}),
	getParameterValue: (parameters: M2D_ICommandParameter[], name: string) => new Promise<string>((res, rej) => {
		if(parameters.find((v) => v.name === name)) {
			res((parameters.find((v) => v.name === name) as M2D_ICommandParameter).value);
		} else rej({
			type: M2D_EErrorTypes.Commands,
			subtype: M2D_ECommandsErrorSubtypes.MissingParameter,
			data: {
				parameterName: name
			}
		} as M2D_ICommandsMissingParameterError);
	}),
	getCommandFromAlias: (alias: string) => new Promise<M2D_ICommand>((res, rej) => {
		if(M2D_COMMANDS.find((v) => v.aliases.find((vv) => vv === alias))) {
			res(M2D_COMMANDS.find((v) => v.aliases.find((vv) => vv === alias)) as M2D_ICommand);
		} else rej({
			type: M2D_EErrorTypes.Commands,
			subtype: M2D_ECommandsErrorSubtypes.MissingAlias,
			data: {
				alias
			}
		} as M2D_ICommandsMissingAliasError);
	}),
	getCommand: (commandName: string) => new Promise<M2D_ICommand>((res, rej) => {
		if(M2D_COMMANDS.find((v) => v.name === commandName)) {
			res(M2D_COMMANDS.find((v) => v.name === commandName) as M2D_ICommand);
		} else rej({
			type: M2D_EErrorTypes.Commands,
			subtype: M2D_ECommandsErrorSubtypes.MissingCommand,
			data: {
				commandName
			}
		} as M2D_ICommandsMissingCommandError);
	}),
	getCategoryFromNameOrLabel: (name: string) => new Promise<M2D_ICommandCategory>((res, rej) => {
		if(M2D_CATEGORIES[name]) {
			res(M2D_CATEGORIES[name]);
		} else {
			for(const cat in M2D_CATEGORIES) {
				if(M2D_CATEGORIES[cat].label === name) res(M2D_CATEGORIES[cat]);
			}
			rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingCategory,
				data: {
					category: name
				}
			} as M2D_ICommandsMissingCategoryError);
		}
	}),
	getCommandsByCategory: (category: M2D_ICommandCategory) => new Promise<M2D_ICommand[]>((res, rej) => {
		if(M2D_COMMANDS.filter((v) => v.category === category).length > 0) {
			res(M2D_COMMANDS.filter((v) => v.category === category));
		} else rej({
			type: M2D_EErrorTypes.Commands,
			subtype: M2D_ECommandsErrorSubtypes.NoCommandsInCategory,
			data: {
				category
			}
		} as M2D_ICommandsNoCommandsInCategoryError);
	}),
	buildCommandParameters: (command: M2D_ICommand, params: string[]) => new Promise<M2D_ICommandParameter[]>((res, rej) => {
		if(command.parameters.length === 0) {
			res([]);
		} else {
			const cmdRequiredParamsCount = command.parameters.filter((v) => v.required).length;
			const cmdParamsCount = command.parameters.length;
			const paramsCount = params.length;
			const outputParams: M2D_ICommandParameter[] = [];

			if(paramsCount >= cmdRequiredParamsCount && paramsCount <= cmdParamsCount) {
				if(paramsCount > 0) {
					for(let i = 0; i < paramsCount; i++) {
						outputParams.push({
							name: command.parameters[i].name,
							value: params[i]
						});
					}
				}
				res(outputParams);
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.InsufficientParameters,
				data: {
					commandName: command.name,
					requiredParametersCount: cmdRequiredParamsCount,
					allParametersCount: cmdParamsCount,
					receivedParametersCount: paramsCount
				}
			} as M2D_ICommandsInsufficientParametersError)
		}
	}),
	buildCommandHelpMessage: (command: M2D_ICommand, guildId: string | null = null, printCategory = false) => new Promise<string>((res, rej) => {
		const { name, aliases, category, description, parameters } = command;

		M2D_ConfigUtils.getConfigValue("prefix", guildId)
			.then((prefix: string) => {
				const aliasesString = (aliases.length > 0) ? `${name}|${aliases.join("|")}` : `${name}`;
				const paramsString = (parameters.length > 0) ? parameters.map((v) => `[${v.name}${(!v.required) ? "?" : ""}]`).join(" ") : "";
				const paramsExplanations = (parameters.length > 0) ? `${parameters.map((v) => `\`${v.name}\` (${v.label}) - ${v.description}${(v.required) ? " **WYMAGANY**" : ""}`).join("\n\n")}\n` : `\`-\`\n`;

				const outputMsg = `\`${name}\`\n**Aliasy**: ${(aliases.length > 0) ? aliases.join(", ") : "Brak"}\n${(printCategory) ? `**Kategoria**: ${category.label}\n` : ""}**Opis**: ${description}\n**U??ycie**:\n\`${prefix}${aliasesString} ${paramsString}\`\n${(parameters.length > 0) ? `\n${paramsExplanations}\n` : "\n"}`;
				
				res(outputMsg);
			})
			.catch((err) => rej(err));
	}),
	invokeCommand: (command: M2D_ICommand, parameters: M2D_ICommandParameter[], suppParameters?: M2D_ICommandSuppParameters) => new Promise<void>((res, rej) => {
		const invokeId: string = nanoid(10);
		
		M2D_LogUtils.logMessage(`info`, `Wywo??ywanie komendy "${command.name}"... ID wywo??ania: "${invokeId}"`)
			.then(() => {
				if(suppParameters) M2D_LogUtils.logMessage(`info`, `IID: "${invokeId}" - Wywo??anie zosta??o za????dane przez "${suppParameters.user.tag}".`);
				else M2D_LogUtils.logMessage(`info`, `IID: "${invokeId}" - Wywo??anie zosta??o za????dane od wewn??trz.`);

				command.handler(command, parameters, suppParameters)
					.then(() => M2D_LogUtils.logMessage(`success`, `IID: "${invokeId}" - Pomy??lnie wywo??ano komend??!`)
						.then(() => res())	
					)
					.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`warn`, [`IID: "${invokeId}" - Wyst??pi?? b????d przy wywo??ywaniu komendy.`, `IID: "${invokeId}" - Oznaczenie b????du: "${M2D_GeneralUtils.getErrorString(err)}"`, `IID: "${invokeId}" - Dane o b????dzie: "${JSON.stringify(err.data)}"`, `IID: ${invokeId} - Uruchamianie obs??ugi b????d??w komendy...`])
						.then(() => command.errorHandler(err, command, parameters, suppParameters)
							.then(() => M2D_LogUtils.logMessage(`success`, `IID: "${invokeId}" - Obs??uga b????d??w nie zg??osi??a ??adnych zastrze??e??. Uznano wykonanie komendy za pomy??lne.`)
								.then(() => res())
							)
							.catch((errerr) => M2D_LogUtils.logMultipleMessages(`error`, [`IID: "${invokeId}" - Obs??uga b????d??w zg??osi??a nast??puj??cy b????d:`, `IID: "${invokeId}" - Oznaczenie b????du: "${M2D_GeneralUtils.getErrorString(errerr)}"`, `IID: "${invokeId}" - Dane o b????dzie: "${JSON.stringify(err.data)}"`, `IID: "${invokeId}" - Przekazywanie b????du dalej...`])
								.then(() => rej(errerr))
							)
						)
					)
			})	
	}),
	addCommands: (commands: M2D_ICommand[]) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano operacj?? dodania nowych komend...`)
			.then(() => {
				const cmds: M2D_ICommand[] = [...M2D_COMMANDS, ...commands];
				
				M2D_CommandUtils.validateCommands(cmds)
					.then(() => {
						M2D_COMMANDS.push(...commands);
						M2D_LogUtils.logMessage(`success`, `Operacja dodania nowych komend zako??czy??a si?? sukcesem!`)
							.then(() => res());
					})
					.catch((err) => M2D_LogUtils.logMessage(`error`, `Wyst??pi?? b????d podczas dodawania nowych komend. Nowe komendy nie zosta??y dodane.`)
						.then(() => rej(err))
					);
			});	
	}),
	initCommandCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie komend...`)
			.then(() => M2D_CommandUtils.validateCommands())
			.then(() => M2D_CommandUtils.addCommands(M2D_DEV_COMMANDS))
			.then(() => M2D_CommandUtils.addCommands(M2D_CHAT_NON_INVOKABLES))
			.then(() => M2D_CommandUtils.addCommands(M2D_UTIL_COMMANDS))
			.then(() => {
				M2D_LogUtils.logMessage(`success`, `Zainicjalizowano komendy!`)
					.then(() => res());
			})
			.catch((err: M2D_Error) => rej(err));
	})
};

//#region Exports
	export type {
		M2D_ICommand,
		M2D_ICommandCategory,
		M2D_ICommandParameter,
		M2D_ICommandParameterDesc,
		M2D_ICommandSuppParameters,
		M2D_ICommandsMissingCommandError,
		M2D_ICommandsInsufficientParametersError,
		M2D_ICommandsMissingSuppParametersError,
		M2D_ICommandsMissingAliasError,
		M2D_ICommandsMissingCategoryError,
		M2D_ICommandsMissingParameterError,
		M2D_ICommandsCommandDeveloperOnlyError,
		M2D_ICommandsCommandNotInvokableInChatError,
		M2D_ICommandsNoCommandsInCategoryError,
		M2D_ICommandsCommandNotActiveError,
		M2D_ICommandsDuplicateAliasesError,
		M2D_CommandsError
	};
	export {
		M2D_ECommandsErrorSubtypes,
		M2D_CommandUtils,
		M2D_CATEGORIES,
		M2D_HIDDEN_CATEGORIES
	};
//#endregion