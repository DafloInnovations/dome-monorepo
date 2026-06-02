import {
  OpenGameStatus,
  PlayerStatus,
  SkillLevel,
  SportType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification, saveNotification } from "../lib/firebase";

const EARTH_KM = 6371;
function toRad(d: number) { return (d * Math.PI) / 180; }
function boundingBox(lat: number, lng: number, km: number) {
  const latΔ = (km / EARTH_KM) * (180 / Math.PI);
  const lngΔ = (km / (EARTH_KM * Math.cos(toRad(lat)))) * (180 / Math.PI);
  return { latMin: lat - latΔ, latMax: lat + latΔ, lngMin: lng - lngΔ, lngMax: lng + lngΔ };
}
function haversineKm(la1: number, lo1: number, la2: number, lo2: number) {
  const dLat = toRad(la2 - la1), dLng = toRad(lo2 - lo1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function appError(msg: string, status = 500, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

function coerceSport(s: string): SportType {
  const v = s.toUpperCase() as SportType;
  if (!Object.values(SportType).includes(v)) throw appError(`Invalid sport: ${s}`, 400);
  return v;
}
function coerceSkill(s: string): SkillLevel {
  const v = s.toUpperCase() as SkillLevel;
  if (!Object.values(SkillLevel).includes(v)) throw appError(`Invalid skill level: ${s}`, 400);
  return v;
}

// Shared include shape
const gameInclude = {
  host: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  facility: { select: { id: true, name: true, address: true } },
  _count: { select: { participants: true } },
} satisfies Prisma.OpenGameInclude;

const gameDetailInclude = {
  host: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  facility: { select: { id: true, name: true, address: true } },
  participants: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: "asc" as const },
  },
} satisfies Prisma.OpenGameInclude;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateGameInput {
  facilityId: string;
  slotId?: string;
  sport: string;
  gameDate: string;    // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  playersNeeded: number;
  skillLevel: string;
  description?: string;
}

export interface ListGamesParams {
  sport?: string;
  date?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  page?: number;
  limit?: number;
}

// ─── List / discover games ────────────────────────────────────────────────────

export async function listGames(params: ListGamesParams = {}) {
  const { sport, date, city, lat, lng, radiusKm = 25, page = 1, limit = 20 } = params;
  const take = Math.min(limit, 50);
  const skip = (Math.max(page, 1) - 1) * take;
  const geoSearch = lat !== undefined && lng !== undefined;

  const addressFilter: Prisma.FacilityAddressWhereInput = {};
  if (city) addressFilter.city = { contains: city, mode: "insensitive" };
  if (geoSearch) {
    const bb = boundingBox(lat!, lng!, radiusKm);
    addressFilter.lat = { not: null, gte: bb.latMin, lte: bb.latMax };
    addressFilter.lng = { not: null, gte: bb.lngMin, lte: bb.lngMax };
  }

  const where: Prisma.OpenGameWhereInput = {
    status: OpenGameStatus.OPEN,
    isPublic: true,
    ...(sport && { sport: coerceSport(sport) }),
    ...(date && { gameDate: new Date(date + "T00:00:00Z") }),
    ...(Object.keys(addressFilter).length > 0 && {
      facility: { address: { is: addressFilter } },
    }),
  };

  const games = await prisma.openGame.findMany({
    where,
    include: gameInclude,
    orderBy: { gameDate: "asc" },
    take: geoSearch ? 200 : take,
    skip: geoSearch ? 0 : skip,
  });

  let results = games.map(serialiseGame);

  if (geoSearch) {
    results = results
      .map((g) => {
        const addr = (g as any).facility?.address;
        const dist =
          addr?.lat != null && addr?.lng != null
            ? haversineKm(lat!, lng!, addr.lat, addr.lng)
            : undefined;
        return { ...g, distanceKm: dist };
      })
      .filter((g) => g.distanceKm === undefined || g.distanceKm <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      .slice(skip, skip + take);
  }

  return { data: results, page, limit: take };
}

// ─── Get game detail ──────────────────────────────────────────────────────────

export async function getGame(gameId: string) {
  const game = await prisma.openGame.findUnique({
    where: { id: gameId },
    include: gameDetailInclude,
  });
  if (!game) throw appError("Game not found", 404);
  return serialiseGameDetail(game);
}

// ─── Create game ──────────────────────────────────────────────────────────────

export async function createGame(userId: string, input: CreateGameInput) {
  const facility = await prisma.facility.findUnique({ where: { id: input.facilityId } });
  if (!facility) throw appError("Facility not found", 404);

  if (input.slotId) {
    const slot = await prisma.slot.findUnique({ where: { id: input.slotId } });
    if (!slot) throw appError("Slot not found", 404);
    if (slot.status !== "AVAILABLE") throw appError("Slot is not available", 409);
  }

  const [y, m, d] = input.gameDate.split("-").map(Number);
  const gameDate = new Date(Date.UTC(y!, m! - 1, d!));

  const game = await prisma.openGame.create({
    data: {
      hostUserId: userId,
      facilityId: input.facilityId,
      slotId: input.slotId ?? null,
      sport: coerceSport(input.sport),
      skillLevel: coerceSkill(input.skillLevel),
      description: input.description,
      gameDate,
      startTime: input.startTime,
      endTime: input.endTime,
      playersNeeded: input.playersNeeded,
      playersConfirmed: 1,  // host counts as confirmed
      maxPlayers: input.playersNeeded,
      status: OpenGameStatus.OPEN,
      isPublic: true,
    },
    include: gameDetailInclude,
  });

  // Lock the slot if provided
  if (input.slotId) {
    await prisma.slot.update({ where: { id: input.slotId }, data: { status: "OPEN_GAME" } });
  }

  return serialiseGameDetail(game);
}

// ─── Join game ────────────────────────────────────────────────────────────────

export async function joinGame(userId: string, gameId: string) {
  const game = await prisma.openGame.findUnique({ where: { id: gameId } });
  if (!game) throw appError("Game not found", 404);
  if (game.status !== OpenGameStatus.OPEN) throw appError("Game is no longer open", 409, "GAME_NOT_OPEN");
  if (game.hostUserId === userId) throw appError("You are the host", 400);

  const existing = await prisma.openGameParticipant.findUnique({
    where: { openGameId_userId: { openGameId: gameId, userId } },
  });
  if (existing) throw appError("You have already requested to join", 409, "ALREADY_JOINED");

  const participant = await prisma.openGameParticipant.create({
    data: { openGameId: gameId, userId, status: PlayerStatus.PENDING },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Notify the host
  const host = await prisma.user.findUnique({
    where: { id: game.hostUserId },
    select: { deviceToken: true },
  });
  const playerName = [participant.user.firstName, participant.user.lastName]
    .filter(Boolean).join(" ") || "A player";
  const sport = game.sport.charAt(0) + game.sport.slice(1).toLowerCase();
  const joinTitle = "New Join Request 🏸";
  const joinBody = `${playerName} wants to join your ${sport} game`;
  const joinData = { type: "join_request", gameId: game.id };
  await saveNotification(game.hostUserId, "JOIN_REQUEST", joinTitle, joinBody, joinData);
  if (host?.deviceToken) {
    await sendPushNotification(host.deviceToken, joinTitle, joinBody, joinData);
  }

  return participant;
}

// ─── Confirm player ───────────────────────────────────────────────────────────

export async function confirmPlayer(hostId: string, gameId: string, targetUserId: string) {
  const game = await prisma.openGame.findUnique({ where: { id: gameId } });
  if (!game) throw appError("Game not found", 404);
  if (game.hostUserId !== hostId) throw appError("Only the host can confirm players", 403);

  const participant = await prisma.openGameParticipant.findUnique({
    where: { openGameId_userId: { openGameId: gameId, userId: targetUserId } },
  });
  if (!participant) throw appError("Player not found", 404);
  if (participant.status === PlayerStatus.CONFIRMED) throw appError("Player already confirmed", 400);

  const playersConfirmed = (game.playersConfirmed ?? 0) + 1;
  const isFull = game.playersNeeded != null && playersConfirmed >= game.playersNeeded;

  const [, updatedGame] = await prisma.$transaction([
    prisma.openGameParticipant.update({
      where: { openGameId_userId: { openGameId: gameId, userId: targetUserId } },
      data: { status: PlayerStatus.CONFIRMED, confirmedAt: new Date() },
    }),
    prisma.openGame.update({
      where: { id: gameId },
      data: {
        playersConfirmed,
        ...(isFull && { status: OpenGameStatus.FULL }),
      },
      include: { facility: { select: { name: true } } },
    }),
  ]);

  // Notify the confirmed player
  const player = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { deviceToken: true },
  });
  const confSport = updatedGame.sport.charAt(0) + updatedGame.sport.slice(1).toLowerCase();
  const confFacility = (updatedGame as any).facility?.name ?? "the facility";
  const confTitle = "You're In! 🎉";
  const confBody = `You've been confirmed for ${confSport} at ${confFacility}`;
  const confData = { type: "player_confirmed", gameId };
  await saveNotification(targetUserId, "PLAYER_CONFIRMED", confTitle, confBody, confData);
  if (player?.deviceToken) {
    await sendPushNotification(player.deviceToken, confTitle, confBody, confData);
  }

  return { confirmed: true, gameFull: isFull };
}

// ─── Decline player ───────────────────────────────────────────────────────────

export async function declinePlayer(hostId: string, gameId: string, targetUserId: string) {
  const game = await prisma.openGame.findUnique({ where: { id: gameId } });
  if (!game) throw appError("Game not found", 404);
  if (game.hostUserId !== hostId) throw appError("Only the host can decline players", 403);

  const [gameWithFacility] = await prisma.$transaction([
    prisma.openGame.findUnique({
      where: { id: gameId },
      include: { facility: { select: { name: true } } },
    }) as any,
    prisma.openGameParticipant.update({
      where: { openGameId_userId: { openGameId: gameId, userId: targetUserId } },
      data: { status: PlayerStatus.DECLINED },
    }),
  ]);

  // Notify the declined player
  const player = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { deviceToken: true },
  });
  if (gameWithFacility) {
    const declSport = gameWithFacility.sport.charAt(0) + gameWithFacility.sport.slice(1).toLowerCase();
    const declFacility = gameWithFacility.facility?.name ?? "the facility";
    const declTitle = "Request Declined";
    const declBody = `Your request for ${declSport} at ${declFacility} was declined`;
    const declData = { type: "player_declined", gameId };
    await saveNotification(targetUserId, "PLAYER_DECLINED", declTitle, declBody, declData);
    if (player?.deviceToken) {
      await sendPushNotification(player.deviceToken, declTitle, declBody, declData);
    }
  }

  return { declined: true };
}

// ─── Close game ───────────────────────────────────────────────────────────────

export async function closeGame(hostId: string, gameId: string) {
  const game = await prisma.openGame.findUnique({ where: { id: gameId } });
  if (!game) throw appError("Game not found", 404);
  if (game.hostUserId !== hostId) throw appError("Only the host can close this game", 403);
  if (game.status === OpenGameStatus.CANCELLED) throw appError("Game already cancelled", 400);

  await prisma.openGame.update({
    where: { id: gameId },
    data: { status: OpenGameStatus.CANCELLED },
  });

  // Release slot if one was linked
  if (game.slotId) {
    await prisma.slot.update({ where: { id: game.slotId }, data: { status: "AVAILABLE" } });
  }

  return { closed: true };
}

// ─── My games ─────────────────────────────────────────────────────────────────

export async function myGames(userId: string) {
  const [hosted, joined] = await Promise.all([
    prisma.openGame.findMany({
      where: { hostUserId: userId },
      include: gameInclude,
      orderBy: { gameDate: "desc" },
    }),
    prisma.openGame.findMany({
      where: { participants: { some: { userId } } },
      include: {
        ...gameInclude,
        participants: {
          where: { userId },
          select: { status: true },
        },
      },
      orderBy: { gameDate: "desc" },
    }),
  ]);

  return {
    hosted: hosted.map(serialiseGame),
    joined: joined.map((g) => ({
      ...serialiseGame(g),
      myStatus: (g as any).participants?.[0]?.status ?? null,
    })),
  };
}

// ─── Serialisers ─────────────────────────────────────────────────────────────

function serialiseGame(g: any) {
  return {
    ...g,
    gameDate: g.gameDate ? g.gameDate.toISOString().split("T")[0] : null,
    pricePerPlayerCAD: g.pricePerPlayerCAD != null ? Number(g.pricePerPlayerCAD) : null,
    spotsLeft: g.playersNeeded != null ? Math.max(0, g.playersNeeded - (g.playersConfirmed ?? 0)) : null,
  };
}

function serialiseGameDetail(g: any) {
  const base = serialiseGame(g);
  return {
    ...base,
    participants: (g.participants ?? []).map((p: any) => ({
      ...p,
      user: p.user,
    })),
  };
}
