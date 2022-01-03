//#region Imports
	import { nanoid } from "nanoid";
	import { M2D_EErrorTypes, M2D_Error, M2D_GeneralUtils, M2D_IError, M2D_IEmbedOptions, M2D_EmbedType } from "./utils";
	import { VoiceConnection, AudioPlayer, AudioResource, joinVoiceChannel, DiscordGatewayAdapterCreator, VoiceConnectionState, VoiceConnectionStatus, PlayerSubscription, getVoiceConnection } from "@discordjs/voice";
	import { Guild, GuildBasedChannel, GuildMember, VoiceBasedChannel, VoiceChannel } from "discord.js";
	import { M2D_IClientMissingGuildError, M2D_IClientMissingChannelError, M2D_EClientErrorSubtypes, M2D_ClientUtils, M2D_IClientMissingGuildChannelError, M2D_IClientInsufficientPermissionsError } from "./client";
	import { M2D_ConfigUtils } from "./config";
	import { M2D_LogUtils } from "./log";
	import { M2D_ICommand, M2D_ICommandCategory, M2D_ICommandParameter, M2D_ICommandParameterDesc, M2D_ICommandSuppParameters, M2D_CATEGORIES, M2D_ICommandsMissingSuppParametersError, M2D_ECommandsErrorSubtypes, M2D_CommandUtils } from "./commands";
//#endregion

//#region Types
	interface M2D_IVoiceConnection {
		id: string;
		guildId: string;
		channelId: string;
		playerSubscription: PlayerSubscription | null;
		noVCMembersElapsedTime: number;
		vcDisconnectedElapsedTime: number;
	};
	//#region Error types
		const enum M2D_EVoiceErrorSubtypes {
			Connected = "CONNECTED",
			Disconnected = "DISCONNECTED",
			Destroyed = "DESTROYED",
			WrongChannelType = "WRONG_CHANNEL_TYPE",
			UserNotConnectedToVoiceChannel = "USER_NOT_CONNECTED_TO_VOICE_CHANNEL"
		};
		interface M2D_IVoiceConnectedError extends M2D_IError {
			data: {
				guildId: string;
				channelId: string;
			}
		};
		interface M2D_IVoiceDisconnectedError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IVoiceDestroyedError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IVoiceWrongChannelTypeError extends M2D_IError {
			data: {
				channel: GuildBasedChannel;
				expectedType: string;
				receivedType: string;
			}
		};
		interface M2D_IVoiceUserNotConnectedToVoiceChannelError extends M2D_IError {
			data: {
				guildId: string;
				userId: string;
			}
		};
		type M2D_VoiceError = M2D_IVoiceConnectedError |
			M2D_IVoiceDisconnectedError |		
			M2D_IVoiceDestroyedError |
			M2D_IVoiceWrongChannelTypeError |
			M2D_IVoiceUserNotConnectedToVoiceChannelError;
	//#endregion
//#endregion

let noVCMembersTimeout = 60;
let voiceConnectionDisconnectedTimeout = 60;
const M2D_VOICE_CONNECTIONS: M2D_IVoiceConnection[] = [];

const M2D_VoiceTimer = setInterval(async () => {
	for(const [i, v] of M2D_VOICE_CONNECTIONS.entries()) {
		M2D_ClientUtils.getGuildFromId(v.guildId)
			.then((guild) => M2D_ClientUtils.getGuildChannelFromId(v.guildId, v.channelId)
				.then((channel: GuildBasedChannel) => {
					if(channel.isVoice()) {
						let minVCMembers: number;
						
						M2D_ConfigUtils.getConfigValue("minVCMembers", v.guildId, false, false)
							.then((val) => minVCMembers = parseInt(val, 10))
							.catch(() => minVCMembers = 1)
							.then(() => {
								M2D_VoiceUtils.isVoiceConnectionDisconnected(v.guildId)
									.then((isDis) => {
										if(isDis) {
											M2D_VOICE_CONNECTIONS[i].noVCMembersElapsedTime = 0;
											if(v.vcDisconnectedElapsedTime < voiceConnectionDisconnectedTimeout) {
												M2D_VOICE_CONNECTIONS[i].vcDisconnectedElapsedTime++;
											} else {
												M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | VCID: "${v.id}" - upłynął czas, po którym nieaktywne połączenie głosowe przechodzi w stan "DESTROYED" - wykonywanie...`)
													.then(() => M2D_VoiceUtils.destroyVoiceConnection(v.guildId))
													.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${v.guildId}" | VCID: "${v.id}" - nie udało się rozłączyć nieaktywnego połączenia`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err)}"` ]));
											}
										} else {
											M2D_VOICE_CONNECTIONS[i].vcDisconnectedElapsedTime = 0;
											if(((channel as VoiceChannel).members.size - 1) < minVCMembers) {
												if(v.noVCMembersElapsedTime < noVCMembersTimeout) {
													M2D_VOICE_CONNECTIONS[i].noVCMembersElapsedTime++;
												} else {
													M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | VCID: "${v.id}" - na kanale "${channel.name}" znajduje się mniej użytkowników, niż na to zezwala "minVCMembers" i dozwolony czas już upłynął. Rozłączanie z kanału...`)
														.then(() => M2D_VoiceUtils.destroyVoiceConnection(v.guildId))
														.catch(() => {return;});
												}
											} else {
												M2D_VOICE_CONNECTIONS[i].noVCMembersElapsedTime = 0;
											}
										}
									})
							});
					}
				})
			)
	}
}, 1000);

const M2D_VoiceUtils = {
	doesVoiceConnectionExistOnGuild: (guildId: string) => M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) !== undefined,
	isVoiceConnectionDisconnected: (guildId: string) => new Promise<boolean>((res, rej) => {
		if(M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
			const vcData = M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) as M2D_IVoiceConnection;
			const vc = getVoiceConnection(guildId);

			if(vc) {
				if(vc.state.status === VoiceConnectionStatus.Disconnected || vc.state.status === VoiceConnectionStatus.Destroyed) {
					res(true);
				} else res(false);
			} else rej({
				type: M2D_EErrorTypes.Voice,
				subtype: M2D_EVoiceErrorSubtypes.Destroyed,
				data: {
					guildId
				}
			} as M2D_IVoiceDestroyedError);
		} else rej({
			type: M2D_EErrorTypes.Voice,
			subtype: M2D_EVoiceErrorSubtypes.Destroyed,
			data: {
				guildId
			}
		} as M2D_IVoiceDestroyedError);
	}),
	getVoiceConnection: (guildId: string) => new Promise<M2D_IVoiceConnection>((res, rej) => {
		M2D_VoiceUtils.isVoiceConnectionDisconnected(guildId)
			.then((isDis: boolean) => {
				if(isDis) {
					rej({
						type: M2D_EErrorTypes.Voice,
						subtype: M2D_EVoiceErrorSubtypes.Disconnected,
						data: {
							guildId
						}
					} as M2D_IVoiceDisconnectedError);
				}
			})
			.catch(() => rej({
				type: M2D_EErrorTypes.Voice,
				subtype: M2D_EVoiceErrorSubtypes.Destroyed,
				data: {
					guildId
				}
			} as M2D_IVoiceDestroyedError))
			.then(() => res(M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) as M2D_IVoiceConnection));
	}),
	createVoiceConnection: (guildId: string, channelId: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Nawiązywanie połączenia z kanałem głosowym o ID "${channelId}" na serwerze o ID "${guildId}"...`)
			.then(() => { 
				M2D_VoiceUtils.isVoiceConnectionDisconnected(guildId)
					.then(isDis => {
						if(isDis) {
							M2D_VoiceUtils.destroyVoiceConnection(guildId)
								.catch(err => M2D_LogUtils.logMultipleMessages(`error`, [ `Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Nie udało się poprawnie zamknąć poprzedniego, nieaktywnego połączenia!` ])
									.then(() => Promise.reject(err))
								);
						} else return M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Już nawiązano wcześniej połączenie z kanałem głosowym na serwerze o ID "${guildId}"!`])
							.then(() => {
								const vC = M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) as M2D_IVoiceConnection;
								const err: M2D_IVoiceConnectedError = {
									type: M2D_EErrorTypes.Voice,
									subtype: M2D_EVoiceErrorSubtypes.Connected,
									data: {
										guildId: vC.guildId,
										channelId: vC.channelId
									}
								};

								return Promise.reject(err);
							})
							.catch(err => Promise.reject(err));	
					})
					.catch((err: M2D_VoiceError) => {
						if(err.subtype === M2D_EVoiceErrorSubtypes.Destroyed) {
							return;
						} else return Promise.reject(err);
					})
					.then(() => M2D_ClientUtils.getGuildFromId(guildId)
						.then((guild: Guild) => M2D_LogUtils.logMessage(`info`, `Nazwa serwera: "${guild.name}"`)
							.then(() => M2D_ClientUtils.getGuildChannelFromId(guildId, channelId)
								.then((channel: GuildBasedChannel) => M2D_LogUtils.logMessage(`info`, `Nazwa kanału: "${channel.name}"`)
									.then(() => {
										if(channel.isVoice()) {
											channel = channel as VoiceBasedChannel;
											const client = M2D_ClientUtils.getClient();

											if(channel.type === "GUILD_VOICE") {
												if(channel.permissionsFor(guild.members.cache.find((v) => v.user === client.user) as GuildMember).has([
													"CONNECT",
													"SPEAK",
													"USE_VAD"
												])) {
													const vCID = nanoid(10);
													M2D_LogUtils.logMessage(`info`, `ID nowego połączenia: "${vCID}"`)
														.then(() => {
															const vC = joinVoiceChannel({
																channelId: channel.id,
																guildId: guild.id,
																adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
															});
															vC.on("stateChange", (oldState, newState) => {
																const oldStatusString: string = (oldState.status === VoiceConnectionStatus.Connecting) ? "CONNECTING" :
																	(oldState.status === VoiceConnectionStatus.Destroyed) ? "DESTROYED" :
																	(oldState.status === VoiceConnectionStatus.Disconnected) ? "DISCONNECTED" :
																	(oldState.status === VoiceConnectionStatus.Ready) ? "READY" :
																	(oldState.status === VoiceConnectionStatus.Signalling) ? "SIGNALLING" : 
																	"UNKNOWN";
																const newStatusString: string = (newState.status === VoiceConnectionStatus.Connecting) ? "CONNECTING" :
																	(newState.status === VoiceConnectionStatus.Destroyed) ? "DESTROYED" :
																	(newState.status === VoiceConnectionStatus.Disconnected) ? "DISCONNECTED" :
																	(newState.status === VoiceConnectionStatus.Ready) ? "READY" :
																	(newState.status === VoiceConnectionStatus.Signalling) ? "SIGNALLING" : 
																	"UNKNOWN";

																switch(newStatusString) {
																	case "DESTROYED":
																		M2D_VoiceUtils.deletePlayerSubscription(guildId)
																			.then(() => M2D_VoiceUtils.deleteVoiceConnection(guildId))
																			.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${guildId}" | VCID: "${vCID}" - wystąpił błąd przy niszczeniu połączenia głosowego`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`]));
																	break;
																}

																M2D_LogUtils.logMessage(`info`, `GID: "${guildId}" | VCID: "${vCID}" - nastąpiła zmiana stanu z "${oldStatusString}" do "${newStatusString}"`);
															});
															vC.on("error", (err: Error) => {
																M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${guildId}" | VCID: "${vCID}" - wystąpił błąd z połączeniem głosowym!`, `Treść błędu: "${err.message}"` ])
																	.then(() => M2D_VoiceUtils.destroyVoiceConnection(guildId))
																	.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${guildId}" | VCID: "${vCID}" - wystąpił błąd podczas niszczenia wadliwego połączenia głosowego!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"` ]));
															});
															M2D_VOICE_CONNECTIONS.push({
																id: vCID,
																guildId: guild.id,
																channelId: channel.id,
																playerSubscription: null,
																noVCMembersElapsedTime: 0,
																vcDisconnectedElapsedTime: 0,
															});
															M2D_LogUtils.logMessage(`success`, `Pomyślnie nawiązano połączenie z kanałem głosowym "${channel.name}" na serwerze "${guild.name}"!`)
																.then(() => res());
														});
												} else M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Brakujące uprawnienia`])
													.then(() => rej({
														type: M2D_EErrorTypes.Client,
														subtype: M2D_EClientErrorSubtypes.InsufficientPermissions,
														data: {
															guild,
															channel,
															permissions: [ "CONNECT", "SPEAK", "USE_VAD" ]
														}
													} as M2D_IClientInsufficientPermissionsError));
											} else M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Podany kanał nie jest kanałem głosowym!`, `Typ kanału: "${channel.type}"`])
												.then(() => rej({
													type: M2D_EErrorTypes.Voice,
													subtype: M2D_EVoiceErrorSubtypes.WrongChannelType,
													data: {
														channel,
														expectedType: "GUILD_VOICE",
														receivedType: channel.type
													}
												} as M2D_IVoiceWrongChannelTypeError));
										} else M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Podany kanał ("${channel.name}", "${channelId}") nie jest kanałem głosowym!`])
											.then(() => rej({
												type: M2D_EErrorTypes.Voice,
												subtype: M2D_EVoiceErrorSubtypes.WrongChannelType,
												data: {
													channel
												}
											} as M2D_IVoiceWrongChannelTypeError));
									})
								)
								.catch((err: M2D_IClientMissingGuildChannelError) => M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Nie znaleziono kanału o ID "${channelId}" na serwerze o ID "${guildId}"`])
									.then(() => rej(err))
								)
							)
						)
						.catch((err: M2D_IClientMissingGuildError) => M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas nawiązywania połączenia z kanałem głosowym!`, `Powód: Nie znaleziono serwera o ID "${guildId}"!`])
							.then(() => rej(err))
						)
					)
					.catch((err) => rej(err));
			})
			.catch((err) => rej(err));
	}),
	deleteVoiceConnection: (guildId: string) => new Promise<void>((res, rej) => {
		if(M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
			const voiceConnection = M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) as M2D_IVoiceConnection;
			M2D_LogUtils.logMessage(`info`, `Usuwanie informacji o połączeniu głosowym "${voiceConnection.id}"`)
				.then(() => {	
					const vcIdx = M2D_VOICE_CONNECTIONS.findIndex(v => v === voiceConnection);
					
					M2D_VOICE_CONNECTIONS.splice(vcIdx, 1);
					M2D_LogUtils.logMessage(`success`, `Usunięto informacje o połączeniu głosowym "${voiceConnection.id}"`)
						.then(() => res());
				});
		} else rej({
			type: M2D_EErrorTypes.Voice,
			subtype: M2D_EVoiceErrorSubtypes.Destroyed,
			data: {
				guildId
			}
		} as M2D_IVoiceDestroyedError);
	}),
	destroyVoiceConnection: (guildId: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano rozłączenie z kanałem głosowym na serwerze o ID "${guildId}"...`)
			.then(() => {
				if(M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
					const voiceConnection = M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) as M2D_IVoiceConnection;

					M2D_VoiceUtils.deletePlayerSubscription(guildId)
						.then(() => {
							const vc = getVoiceConnection(guildId);
							
							if(vc) {
								vc.destroy();
								return Promise.resolve();
							} else return Promise.reject({
								type: M2D_EErrorTypes.Voice,
								subtype: M2D_EVoiceErrorSubtypes.Destroyed,
								data: {
									guildId
								}
							} as M2D_IVoiceDestroyedError);
						})
						.then(() => M2D_LogUtils.logMessage(`success`, `Pomyślnie rozłączono z kanałem głosowym na serwerze o ID "${guildId}"!`))
						.then(() => res())
						.catch((err) => rej(err));

				} else M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas rozłączania z kanałem głosowym!`, `Powód: Nie podłączono do żadnego kanału głosowego`])
					.then(() => rej({
						type: M2D_EErrorTypes.Voice,
						subtype: M2D_EVoiceErrorSubtypes.Destroyed,
						data: {
							guildId
						}
					} as M2D_IVoiceDestroyedError));
			});
	}),
	addPlayerSubscription: (guildId: string, playerSubscription: PlayerSubscription) => new Promise<void>((res, rej) => {
		M2D_VoiceUtils.isVoiceConnectionDisconnected(guildId)
			.then((isDis) => {
				if(isDis) {
					rej({
						type: M2D_EErrorTypes.Voice,
						subtype: M2D_EVoiceErrorSubtypes.Disconnected,
						data: { guildId }
					} as M2D_IVoiceDisconnectedError);
				}
			})
			.then(() => M2D_VoiceUtils.getVoiceConnection(guildId))
			.then((vc) => vc.playerSubscription = playerSubscription)
			.then(() => res())
			.catch((err) => rej(err));	
	}),
	deletePlayerSubscription: (guildId: string) => new Promise<void>((res, rej) => {
		if(M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
			const vc = M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId);

			if(vc) {
				if(vc.playerSubscription !== null) { 
					vc.playerSubscription.unsubscribe();
					vc.playerSubscription = null;
				}
				res();
			} else rej({
					type: M2D_EErrorTypes.Voice,
					subtype: M2D_EVoiceErrorSubtypes.Destroyed,
					data: { guildId }
				} as M2D_IVoiceDestroyedError);
		} else rej({
			type: M2D_EErrorTypes.Voice,
			subtype: M2D_EVoiceErrorSubtypes.Destroyed,
			data: { guildId }
		} as M2D_IVoiceDestroyedError);
	}),
	initVoiceCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie możliwości głosowych...`)
			.then(() => M2D_ConfigUtils.getConfigValue("noVCMembersTimeout")
				.then((val) => {
					noVCMembersTimeout = parseInt(val, 10);
				})
				.catch(() => {return;})
			)
			.then(() => M2D_ConfigUtils.getConfigValue("voiceConnectionDisconnectedTimeout")
				.then((val) => { voiceConnectionDisconnectedTimeout = parseInt(val, 10); })
				.catch(() => {return;})
			)
			.then(() => M2D_CommandUtils.addCommands(M2D_VOICE_COMMANDS))
			.then(() => {
				M2D_VoiceTimer.refresh();
			})
			.then(() => M2D_LogUtils.logMessage(`success`, `Zainicjalizowano możliwości głosowe!`)
					.then(() => res())
			)
			.catch((err) => rej(err));
	}),
	voiceExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wyłączanie możliwości głosowych...`)
			.then(() => {	
				const promisesToHandle: Promise<void>[] = [];
				for(const [i, v] of M2D_VOICE_CONNECTIONS.entries()) {
					promisesToHandle.push(M2D_VoiceUtils.destroyVoiceConnection(v.guildId));
				}
				Promise.all(promisesToHandle)
					.then(() => {
						clearInterval(M2D_VoiceTimer);
						M2D_LogUtils.logMessage(`success`, `Wyłączono możliwości głosowe!`)
							.then(() => res());	
					})
					.catch((err) => rej(err));
			});
	})
};

const M2D_VOICE_COMMANDS: M2D_ICommand[] = [
	{
		name: "dołącz",
		category: M2D_CATEGORIES.voice,
		aliases: ["dł"],
		parameters: [],
		description: "Dołącza Muzyka2D na kanał głosowy, na którym znajduje się wywołujący komendę",
		active: true,
		developerOnly: false,
		chatInvokable: true,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_ClientUtils.getGuildMemberFromId(guild.id, user.id)
					.then((guildMember: GuildMember) => {
						if(guildMember.voice.channel) {
							const vCh = guildMember.voice.channel as VoiceBasedChannel;

							M2D_VoiceUtils.createVoiceConnection(guild.id, vCh.id)
								.then(() => {
									M2D_ClientUtils.sendMessageReplyInGuild(message, {
										embeds: [
											M2D_GeneralUtils.embedBuilder({
												type: "success",
												title: "Dołączono!",
												description: `Pomyślnie dołączono na kanał **${vCh.name}**!`
											})
										]
									})
										.then(() => res())
										.catch((err) => rej(err));
								})
								.catch((err) => rej(err));
						} else rej({
							type: M2D_EErrorTypes.Voice,
							subtype: M2D_EVoiceErrorSubtypes.UserNotConnectedToVoiceChannel,
							data: {
								guildId: guild.id,
								userId: user.id
							}
						} as M2D_IVoiceUserNotConnectedToVoiceChannelError);
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
					case "VOICE_CONNECTED":
						M2D_ClientUtils.sendMessageReplyInGuild(message, {
							embeds: [
								M2D_GeneralUtils.embedBuilder({
									title: "Błąd!",
									description: `Muzyk2D **już znajduje się na kanale głosowym**!`,
									type: "error"
								})
							]
						})
							.then(() => res())
							.catch((err) => rej(err));	
					break;
					case "VOICE_USER_NOT_CONNECTED_TO_VOICE_CHANNEL":
						M2D_ClientUtils.sendMessageReplyInGuild(message, {
							embeds: [
								M2D_GeneralUtils.embedBuilder({
									title: "Błąd!",
									description: `**Nie znajdujesz się na żadnym kanale głosowym**, więc Muzyk2D **nie wie, gdzie ma dołączyć**!`,
									type: "error"
								})
							]
						})
							.then(() => res())
							.catch((err) => rej(err));	
					break;
					default:
						rej(error);
				}
			} else rej(error);
		})
	},
	{
		name: "odłącz",
		category: M2D_CATEGORIES.voice,
		aliases: ["od", "wypierdalaj", "spierdalaj"],
		parameters: [],
		description: "Odłącza Muzyka2D z obecnego kanału głosowego",
		active: true,
		developerOnly: false,
		chatInvokable: true,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_VoiceUtils.isVoiceConnectionDisconnected(guild.id)
					.then((isDis) => {
						if(!isDis) {
							M2D_VoiceUtils.destroyVoiceConnection(guild.id)
								.then(() => {
									M2D_ClientUtils.sendMessageReplyInGuild(message, {
										embeds: [
											M2D_GeneralUtils.embedBuilder({
												type: "success",
												title: "Odłączono!",
												description: `Pomyślnie odłączono z kanału głosowego!`
											})
										]
									})
										.then(() => res())
										.catch((err) => rej(err));
								})
								.catch(err => rej(err));
						} else rej({
							type: M2D_EErrorTypes.Voice,
							subtype: M2D_EVoiceErrorSubtypes.Disconnected,
							data: {
								guildId: guild.id
							}
						} as M2D_IVoiceDisconnectedError);
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

				const errMessage = M2D_GeneralUtils.getErrorString(error);

				if(errMessage === "VOICE_DESTROYED" || errMessage === "VOICE_DISCONNECTED") {
					M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "error",
								title: "Błąd!",
								description: `Muzyk2D **nie znajduje się obecnie na żadnym kanale głosowym**!`
							})
						]
					})
						.then(() => res())
						.catch((err) => rej(err));
				} else rej(error);
			} else rej(error);
		})
	}
];

//#region Exports
	export type {
		M2D_IVoiceConnection,
		M2D_IVoiceConnectedError,
		M2D_IVoiceDestroyedError,
		M2D_IVoiceUserNotConnectedToVoiceChannelError,
		M2D_VoiceError
	};
	export {
		M2D_EVoiceErrorSubtypes,
		M2D_VoiceUtils
	};
//#endregion