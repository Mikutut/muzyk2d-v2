//#region Imports
	import { nanoid } from "nanoid";
	import { M2D_EErrorTypes, M2D_Error, M2D_GeneralUtils, M2D_IError, M2D_IEmbedOptions, M2D_EmbedType } from "./utils";
	import { VoiceConnection, AudioPlayer, AudioResource, joinVoiceChannel, DiscordGatewayAdapterCreator, VoiceConnectionState, VoiceConnectionStatus, PlayerSubscription, getVoiceConnection } from "@discordjs/voice";
	import { Guild, GuildBasedChannel, GuildMember, User, VoiceBasedChannel, VoiceChannel } from "discord.js";
	import { M2D_IClientMissingGuildError, M2D_IClientMissingChannelError, M2D_EClientErrorSubtypes, M2D_ClientUtils, M2D_IClientMissingGuildChannelError, M2D_IClientInsufficientPermissionsError, M2D_IClientMissingGuildMemberError } from "./client";
	import { M2D_ConfigUtils } from "./config";
	import { M2D_LogUtils } from "./log";
	import { M2D_ICommand, M2D_ICommandCategory, M2D_ICommandParameter, M2D_ICommandParameterDesc, M2D_ICommandSuppParameters, M2D_CATEGORIES, M2D_ICommandsMissingSuppParametersError, M2D_ECommandsErrorSubtypes, M2D_CommandUtils } from "./commands";
	import { M2D_PlaybackUtils } from "./playback";
	import { M2D_MessagesUtils } from "./messages";
	import { M2D_Events } from "./events";
//#endregion

//#region Types
	interface M2D_IVoiceConnection {
		id: string;
		guildId: string;
		channelId: string;
		playerSubscription: PlayerSubscription | null;
    channelMembersCount: number;
	};
	interface M2D_IVoiceTooFewVCMembersTimeoutData {
		voiceConnection: M2D_IVoiceConnection;
		time: number;
	};
	interface M2D_IVoiceDisconnectedTimeoutData {
		voiceConnection: M2D_IVoiceConnection;
		time: number;
	};
	//#region Error types
		const enum M2D_EVoiceErrorSubtypes {
			Connected = "CONNECTED",
			Disconnected = "DISCONNECTED",
			Destroyed = "DESTROYED",
			WrongChannelType = "WRONG_CHANNEL_TYPE",
			UserNotConnectedToVoiceChannel = "USER_NOT_CONNECTED_TO_VOICE_CHANNEL",
			UserNotInTheSameVoiceChannel = "USER_NOT_IN_THE_SAME_VOICE_CHANNEL"
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
		interface M2D_IVoiceUserNotInTheSameVoiceChannelError extends M2D_IError {
			data: {
				guildId: string;
				channelId: string;
				userId: string;
			}
		};
		type M2D_VoiceError = M2D_IVoiceConnectedError |
			M2D_IVoiceDisconnectedError |		
			M2D_IVoiceDestroyedError |
			M2D_IVoiceWrongChannelTypeError |
			M2D_IVoiceUserNotConnectedToVoiceChannelError |
			M2D_IVoiceUserNotInTheSameVoiceChannelError;
	//#endregion
//#endregion

let noVCMembersTimeout = 60;
let voiceConnectionDisconnectedTimeout = 60;
let minVCMembers = 1;
const M2D_VOICE_CONNECTIONS: M2D_IVoiceConnection[] = [];
const M2D_VOICE_TOO_FEW_VC_MEMBERS_TIMEOUT_DATA: M2D_IVoiceTooFewVCMembersTimeoutData[] = [];
const M2D_VOICE_DISCONNECTED_TIMEOUT_DATA: M2D_IVoiceDisconnectedTimeoutData[] = [];

const M2D_VoiceTooFewVCMembersTimeoutTimer = setInterval(async () => {
	for(const [i, v] of M2D_VOICE_TOO_FEW_VC_MEMBERS_TIMEOUT_DATA.entries()) {
		if((v.voiceConnection.channelMembersCount - 1) < minVCMembers) {
			if(v.time < noVCMembersTimeout) {
				v.time++;
			} else {
				M2D_Events.emit("voiceTooFewVCMembersTimeoutFinished", v.voiceConnection);
				M2D_VOICE_TOO_FEW_VC_MEMBERS_TIMEOUT_DATA.splice(i, 1);
			}
		} else {
			await M2D_LogUtils.logMessage(`info`, `GID: "${v.voiceConnection.guildId}" - liczba cz??onk??w na kanale wr??ci??a do poziomu akceptowalnego.`)
				.then(() => M2D_VOICE_TOO_FEW_VC_MEMBERS_TIMEOUT_DATA.splice(i, 1));	
		}
	}
}, 1000);
const M2D_VoiceDisconnectedTimeoutTimer = setInterval(async () => {
	for(const [i,v] of M2D_VOICE_DISCONNECTED_TIMEOUT_DATA.entries()) {
		await M2D_VoiceUtils.isVoiceConnectionDisconnected(v.voiceConnection.guildId)
			.then((val) => {
				if(val) {
					if(v.time < voiceConnectionDisconnectedTimeout) {
						v.time++;
					} else {
						M2D_Events.emit("voiceVoiceConnectionDisconnectedTimeoutFinished", v.voiceConnection);
						M2D_VOICE_DISCONNECTED_TIMEOUT_DATA.splice(i, 1);
					}
				} else Promise.reject();
			})
			.catch((err: M2D_Error | undefined) => {
				if(err) {
					return M2D_LogUtils.logMessage(`info`, `GID: "${v.voiceConnection.guildId}" - po????czenie g??osowe zosta??o ju?? zniszczone!`)
						.then(() => {
							M2D_VOICE_DISCONNECTED_TIMEOUT_DATA.splice(i, 1);
						});
				} else {
					return M2D_LogUtils.logMessage(`info`, `GID: "${v.voiceConnection.guildId}" - po????czenie g??osowe zosta??o ponownie nawi??zane!`)
						.then(() => {
							M2D_VOICE_DISCONNECTED_TIMEOUT_DATA.splice(i, 1);
						});	
				}
			})
	}
}, 1000);

//#region Event handlers
  M2D_Events.on("voiceMembersCountChanged", async (guildId: string, membersCount: number) => {
    await M2D_LogUtils.logMultipleMessages(`info`, [`GID: "${guildId}" - wykryto zmian?? liczby cz??onk??w na kanale g??osowym.`, `Analizowanie...`])
      .then(() => M2D_VoiceUtils.getVoiceConnection(guildId))
      .then((vc: M2D_IVoiceConnection) => {
          if((vc.channelMembersCount - 1) < minVCMembers) {
            M2D_Events.emit("voiceTooFewVCMembersTimeoutStarted", vc);
          }
			})
      .catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${guildId}" - analiza sytuacji z liczb?? cz??onk??w na kanale g??osowym nie powiod??a si??.`, `Oznaczenie b????du: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o b????dzie: "${JSON.stringify(err.data)}"`]))
  });
	M2D_Events.on("voiceTooFewVCMembersTimeoutStarted", async (voiceConnection: M2D_IVoiceConnection) => {
		const guildId = voiceConnection.guildId;

		await M2D_LogUtils.logMessage(`info`, `GID: "${guildId}" - wykryto mniejsz?? liczb?? cz??onk??w na kanale ni?? na to pozwala "minVCMembers", czekanie na up??yni??cie timeout'u...`)
			.then(() => M2D_GeneralUtils.ignoreError(
				M2D_MessagesUtils.getMessage("voiceTooFewVCMembersDetected", [ noVCMembersTimeout.toString() ])
					.then((msg) => M2D_ClientUtils.sendMessageInGuild(guildId, undefined, { embeds: [ msg ] }))
			))	
			.then(() => M2D_VOICE_TOO_FEW_VC_MEMBERS_TIMEOUT_DATA.push({ voiceConnection, time: 0 }));
	});
	M2D_Events.on("voiceTooFewVCMembersTimeoutFinished", async (voiceConnection: M2D_IVoiceConnection) => {
		const guildId = voiceConnection.guildId;

		await M2D_LogUtils.logMessage(`info`, `GID: "${guildId}" - niedopuszczalnie niska liczba cz??onk??w na kanale utrzyma??a si?? przez czas wyznaczony przez timeout. Roz????czanie...`)
			.then(() => M2D_VoiceUtils.destroyVoiceConnection(guildId))
			.then(() => M2D_GeneralUtils.ignoreError(
				M2D_MessagesUtils.getMessage("voiceTooFewVCMembersTimeoutFinished")
					.then((msg) => M2D_ClientUtils.sendMessageInGuild(guildId, undefined, { embeds: [ msg ] }))
			))
			.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${guildId}" - nie uda??o si?? zniszczy?? po????czenia g??osowego o zbyt niskiej liczbie cz??onk??w na kanale!`, `Oznaczenie b????du: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o b????dzie: "${JSON.stringify(err.data)}"`]));
	});
  M2D_Events.on("voiceVoiceConnectionDisconnected", async (guildId: string) => {
		M2D_Events.emit("playbackVoiceConnectionDisconnected", guildId);
		await M2D_VoiceUtils.isVoiceConnectionDisconnected(guildId)
			.then((val) => {
				if(val) {
					M2D_VoiceUtils.getVoiceConnection(guildId)
						.then((vc) => M2D_Events.emit("voiceVoiceConnectionDisconnectedTimeoutStarted", vc))
						.catch((err) => Promise.reject(err));
				}
			})
      .catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${guildId}" - wyst??pi?? b????d podczas analizowania stanu po????czenia.`, `Oznaczenie b????du: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o b????dzie: "${JSON.stringify(err.data)}"`]));
  });
	M2D_Events.on("voiceVoiceConnectionDisconnectedTimeoutStarted", async (voiceConnection: M2D_IVoiceConnection) => {
		const guildId = voiceConnection.guildId;

		await M2D_LogUtils.logMultipleMessages(`info`, [`GID: "${guildId}" - wykryto roz????czenie z kana??em`, `Czekanie a?? minie timeout...`])
			.then(() => M2D_VOICE_DISCONNECTED_TIMEOUT_DATA.push({ voiceConnection, time: 0 }));
	});
	M2D_Events.on("voiceVoiceConnectionDisconnectedTimeoutFinished", async (voiceConnection: M2D_IVoiceConnection) => {
		const guildId = voiceConnection.guildId;

		await M2D_LogUtils.logMultipleMessages(`info`, [`GID: "${guildId}" - po????czenie z kana??em g??osowym zosta??o zerwane, a timeout ju?? up??yn????.`, `Niszczenie...`])
			.then(() => M2D_VoiceUtils.destroyVoiceConnection(guildId))
			.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${guildId}" - nie uda??o si?? zniszczy?? zerwanego po????czenia g??osowego!`, `Oznaczenie b????du: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o b????dzie: "${JSON.stringify(err.data)}"`]));
	});
//#endregion

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
	isUserConnectedToTheSameVoiceChannel: (guildId: string, user: User) => new Promise<boolean>((res, rej) => {
		M2D_VoiceUtils.getVoiceConnection(guildId)
			.then((vc) => M2D_ClientUtils.getGuildMemberFromId(guildId, user.id)
				.then((gm) => M2D_ClientUtils.getGuildFromId(guildId)
					.then((g) => {
						const c_GM = g.me;

						if(c_GM) {
							res(gm.voice.channelId === vc.channelId);
						} else return Promise.reject({
							type: M2D_EErrorTypes.Client,
							subtype: M2D_EClientErrorSubtypes.MissingGuildMember,
							data: { guildId, userId: user.id }
						} as M2D_IClientMissingGuildMemberError);
					})
				)
			)
			.catch((err) => rej(err));
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
		M2D_LogUtils.logMessage(`info`, `Nawi??zywanie po????czenia z kana??em g??osowym o ID "${channelId}" na serwerze o ID "${guildId}"...`)
			.then(() => { 
				M2D_VoiceUtils.isVoiceConnectionDisconnected(guildId)
					.then(isDis => {
						if(isDis) {
							M2D_VoiceUtils.destroyVoiceConnection(guildId)
								.catch(err => M2D_LogUtils.logMultipleMessages(`error`, [ `Wyst??pi?? b????d podczas nawi??zywania po????czenia z kana??em g??osowym!`, `Pow??d: Nie uda??o si?? poprawnie zamkn???? poprzedniego, nieaktywnego po????czenia!` ])
									.then(() => Promise.reject(err))
								);
						} else return M2D_LogUtils.logMultipleMessages(`error`, [`Wyst??pi?? b????d podczas nawi??zywania po????czenia z kana??em g??osowym!`, `Pow??d: Ju?? nawi??zano wcze??niej po????czenie z kana??em g??osowym na serwerze o ID "${guildId}"!`])
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
								.then((channel: GuildBasedChannel) => M2D_LogUtils.logMessage(`info`, `Nazwa kana??u: "${channel.name}"`)
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
													M2D_LogUtils.logMessage(`info`, `ID nowego po????czenia: "${vCID}"`)
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
																			.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${guildId}" | VCID: "${vCID}" - wyst??pi?? b????d przy niszczeniu po????czenia g??osowego`, `Oznaczenie b????du: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o b????dzie: "${JSON.stringify(err.data)}"`]));
																	break;
                                  case "DISCONNECTED":
                                    M2D_Events.emit("voiceVoiceConnectionDisconnected", guildId);
                                  break;
																}

																M2D_LogUtils.logMessage(`info`, `GID: "${guildId}" | VCID: "${vCID}" - nast??pi??a zmiana stanu z "${oldStatusString}" do "${newStatusString}"`);
															});
															vC.on("error", (err: Error) => {
																M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${guildId}" | VCID: "${vCID}" - wyst??pi?? b????d z po????czeniem g??osowym!`, `Tre???? b????du: "${err.message}"` ])
																	.then(() => M2D_VoiceUtils.destroyVoiceConnection(guildId))
																	.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${guildId}" | VCID: "${vCID}" - wyst??pi?? b????d podczas niszczenia wadliwego po????czenia g??osowego!`, `Oznaczenie b????du: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o b????dzie: "${JSON.stringify(err.data)}"` ]));
															});
                              return M2D_ClientUtils.getGuildChannelFromId(guildId, channelId)
                                .then((ch: GuildBasedChannel) => {
                                  if(ch.type === "GUILD_VOICE") return ch as VoiceChannel;
                                  else return Promise.reject({
                                    type: M2D_EErrorTypes.Voice,
                                    subtype: M2D_EVoiceErrorSubtypes.WrongChannelType,
                                    data: {
                                      channel: ch,
                                      expectedType: "GUILD_VOICE",
                                      receivedType: ch.type
                                    }
                                  } as M2D_IVoiceWrongChannelTypeError);
                                })
                                .then((ch: VoiceChannel) => {
                                  M2D_VOICE_CONNECTIONS.push({
                                    id: vCID,
                                    guildId: guild.id,
                                    channelId: channel.id,
                                    playerSubscription: null,
                                    channelMembersCount: ch.members.size
                                  });
                                  return M2D_LogUtils.logMessage(`success`, `Pomy??lnie nawi??zano po????czenie z kana??em g??osowym "${channel.name}" na serwerze "${guild.name}"!`)
                                    .then(() => res());
                                })
                                .catch((err) => Promise.reject(err));  
														});
												} else M2D_LogUtils.logMultipleMessages(`error`, [`Wyst??pi?? b????d podczas nawi??zywania po????czenia z kana??em g??osowym!`, `Pow??d: Brakuj??ce uprawnienia`])
													.then(() => rej({
														type: M2D_EErrorTypes.Client,
														subtype: M2D_EClientErrorSubtypes.InsufficientPermissions,
														data: {
															guild,
															channel,
															permissions: [ "CONNECT", "SPEAK", "USE_VAD" ]
														}
													} as M2D_IClientInsufficientPermissionsError));
											} else M2D_LogUtils.logMultipleMessages(`error`, [`Wyst??pi?? b????d podczas nawi??zywania po????czenia z kana??em g??osowym!`, `Pow??d: Podany kana?? nie jest kana??em g??osowym!`, `Typ kana??u: "${channel.type}"`])
												.then(() => rej({
													type: M2D_EErrorTypes.Voice,
													subtype: M2D_EVoiceErrorSubtypes.WrongChannelType,
													data: {
														channel,
														expectedType: "GUILD_VOICE",
														receivedType: channel.type
													}
												} as M2D_IVoiceWrongChannelTypeError));
										} else M2D_LogUtils.logMultipleMessages(`error`, [`Wyst??pi?? b????d podczas nawi??zywania po????czenia z kana??em g??osowym!`, `Pow??d: Podany kana?? ("${channel.name}", "${channelId}") nie jest kana??em g??osowym!`])
											.then(() => rej({
												type: M2D_EErrorTypes.Voice,
												subtype: M2D_EVoiceErrorSubtypes.WrongChannelType,
												data: {
													channel
												}
											} as M2D_IVoiceWrongChannelTypeError));
									})
								)
								.catch((err: M2D_IClientMissingGuildChannelError) => M2D_LogUtils.logMultipleMessages(`error`, [`Wyst??pi?? b????d podczas nawi??zywania po????czenia z kana??em g??osowym!`, `Pow??d: Nie znaleziono kana??u o ID "${channelId}" na serwerze o ID "${guildId}"`])
									.then(() => rej(err))
								)
							)
						)
						.catch((err: M2D_IClientMissingGuildError) => M2D_LogUtils.logMultipleMessages(`error`, [`Wyst??pi?? b????d podczas nawi??zywania po????czenia z kana??em g??osowym!`, `Pow??d: Nie znaleziono serwera o ID "${guildId}"!`])
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
			M2D_LogUtils.logMessage(`info`, `Usuwanie informacji o po????czeniu g??osowym "${voiceConnection.id}"`)
				.then(() => {	
					const vcIdx = M2D_VOICE_CONNECTIONS.findIndex(v => v === voiceConnection);
					
					M2D_VOICE_CONNECTIONS.splice(vcIdx, 1);
					M2D_LogUtils.logMessage(`success`, `Usuni??to informacje o po????czeniu g??osowym "${voiceConnection.id}"`)
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
		M2D_LogUtils.logMessage(`info`, `Zainicjowano roz????czenie z kana??em g??osowym na serwerze o ID "${guildId}"...`)
			.then(() => {
				if(M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
					const voiceConnection = M2D_VOICE_CONNECTIONS.find((v) => v.guildId === guildId) as M2D_IVoiceConnection;

					M2D_VoiceUtils.deletePlayerSubscription(guildId)
						.then(() => {
							const vc = getVoiceConnection(guildId);
							
							if(vc) {
								vc.destroy();
								M2D_Events.emit("playbackVoiceConnectionDestroyed", guildId);
								return Promise.resolve();
							} else return Promise.reject({
								type: M2D_EErrorTypes.Voice,
								subtype: M2D_EVoiceErrorSubtypes.Destroyed,
								data: {
									guildId
								}
							} as M2D_IVoiceDestroyedError);
						})
						.then(() => M2D_LogUtils.logMessage(`success`, `Pomy??lnie roz????czono z kana??em g??osowym na serwerze o ID "${guildId}"!`))
						.then(() => res())
						.catch((err) => rej(err));

				} else M2D_LogUtils.logMultipleMessages(`error`, [`Wyst??pi?? b????d podczas roz????czania z kana??em g??osowym!`, `Pow??d: Nie pod????czono do ??adnego kana??u g??osowego`])
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
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie mo??liwo??ci g??osowych...`)
			.then(() => M2D_ConfigUtils.getConfigValue("noVCMembersTimeout")
				.then((val) => {
					noVCMembersTimeout = parseInt(val, 10);
				})
				.catch((err) => Promise.reject(err))
			)
			.then(() => M2D_ConfigUtils.getConfigValue("voiceConnectionDisconnectedTimeout")
				.then((val) => { voiceConnectionDisconnectedTimeout = parseInt(val, 10); })
				.catch((err) => Promise.reject(err))
			)
			.then(() => M2D_ConfigUtils.getConfigValue("minVCMembers")
				.then((val) => {minVCMembers = parseInt(val, 10);})
				.catch((err) => Promise.reject(err))
			)
			.then(() => M2D_CommandUtils.addCommands(M2D_VOICE_COMMANDS))
			.then(() => M2D_LogUtils.logMessage(`success`, `Zainicjalizowano mo??liwo??ci g??osowe!`)
					.then(() => res())
			)
			.catch((err) => rej(err));
	}),
	voiceExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wy????czanie mo??liwo??ci g??osowych...`)
			.then(() => {	
				const promisesToHandle: Promise<void>[] = [];
				for(const [i, v] of M2D_VOICE_CONNECTIONS.entries()) {
					promisesToHandle.push(M2D_VoiceUtils.destroyVoiceConnection(v.guildId));
				}
				Promise.all(promisesToHandle)
					.then(() => {
						M2D_LogUtils.logMessage(`success`, `Wy????czono mo??liwo??ci g??osowe!`)
							.then(() => res());	
					})
					.catch((err) => rej(err));
			});
	})
};

const M2D_VOICE_COMMANDS: M2D_ICommand[] = [
	{
		name: "do????cz",
		category: M2D_CATEGORIES.voice,
		aliases: ["d??", "j"],
		parameters: [],
		description: "Do????cza Muzyka2D na kana?? g??osowy, na kt??rym znajduje si?? wywo??uj??cy komend??",
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_ClientUtils.getGuildMemberFromId(guild.id, user.id)
					.then((guildMember: GuildMember) => {
						if(guildMember.voice.channel) {
							const vCh = guildMember.voice.channel as VoiceBasedChannel;

							M2D_VoiceUtils.createVoiceConnection(guild.id, vCh.id)
								.then(() => M2D_MessagesUtils.getMessage("voiceConnectedToVoiceChannel", [ vCh.name ]))
								.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
									embeds: [ msg ]
								}))
								.then(() => Promise.resolve())
								.catch((err) => Promise.reject(err));
						} else return Promise.reject({
							type: M2D_EErrorTypes.Voice,
							subtype: M2D_EVoiceErrorSubtypes.UserNotConnectedToVoiceChannel,
							data: {
								guildId: guild.id,
								userId: user.id
							}
						} as M2D_IVoiceUserNotConnectedToVoiceChannelError);
					})
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
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				switch(M2D_GeneralUtils.getErrorString(error)) {
					case "VOICE_CONNECTED":
						M2D_MessagesUtils.getMessage("voiceClientAlreadyInVoiceChannel")
							.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
								embeds: [ msg ]
							}))	
							.then(() => res())
							.catch((err) => rej(err));	
					break;
					case "VOICE_USER_NOT_CONNECTED_TO_VOICE_CHANNEL":
						M2D_MessagesUtils.getMessage("voiceUserNotInVoiceChannel")
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
		})
	},
	{
		name: "od????cz",
		category: M2D_CATEGORIES.voice,
		aliases: ["od", "wypierdalaj", "spierdalaj", "dc"],
		parameters: [],
		description: "Od????cza Muzyka2D z obecnego kana??u g??osowego",
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_VoiceUtils.isVoiceConnectionDisconnected(guild.id)
					.then((isDis) => {
						if(!isDis) {
							return M2D_VoiceUtils.isUserConnectedToTheSameVoiceChannel(guild.id, user)
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
								.then(() => M2D_VoiceUtils.destroyVoiceConnection(guild.id))
								.catch((err) => Promise.reject(err));
						} else return Promise.reject({
							type: M2D_EErrorTypes.Voice,
							subtype: M2D_EVoiceErrorSubtypes.Disconnected,
							data: {
								guildId: guild.id
							}
						} as M2D_IVoiceDisconnectedError);
					})
					.then(() => M2D_MessagesUtils.getMessage("voiceDisconnectedFromVoiceChannel"))
					.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [ msg ]
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
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				const errMessage = M2D_GeneralUtils.getErrorString(error);

				if(errMessage === "VOICE_DESTROYED" || errMessage === "VOICE_DISCONNECTED") {
					M2D_MessagesUtils.getMessage("voiceClientNotInVoiceChannel")
						.then((msg) => M2D_ClientUtils.sendMessageReplyInGuild(message, {
							embeds: [ msg ]
						}))
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
		M2D_IVoiceUserNotInTheSameVoiceChannelError,
		M2D_VoiceError
	};
	export {
		M2D_EVoiceErrorSubtypes,
		M2D_VoiceUtils
	};
//#endregion