import * as version from "./version";
import * as register from "./register";
import * as resetAll from "./resetAll";
import * as resetPoints from "./resetPoints";
import * as profile from "./profile";
import * as launch from "./launch";
import * as assignRole from "./assignRole";
import * as setPoints from "./setPoints";
import * as setPointsBackup from "./setPointsBackup";
import * as saveWar from "./saveWar";
import * as raids from "./raids";
import * as saveRaid from "./saveRaid";
import * as history from "./history";
import * as ranking from "./ranking";
import * as exportExcel from "./exportExcel";
import * as backup from "./backup";
import * as resetHistory from "./resetHistory";
import * as help from "./help";
import * as startYear from "./startYear";
import * as endYear from "./endYear";
import * as resetPromotion from "./resetPromotion";
import * as syncRaids from "./syncRaids";
import * as saveLigue from "./saveLigue";

export const commands = {
    version,
    register,
    "reset-all": resetAll,
    "reset-points": resetPoints,
    profile,
    launch,
    "assign-role": assignRole,
    "set-points": setPoints,
    "set-points-backup": setPointsBackup,
    "save-war": saveWar,
    raids,
    "save-raid": saveRaid,
    history,
    ranking,
    export: exportExcel,
    backup,
    "reset-history": resetHistory,
    help,
    "start-year": startYear,
    "end-year": endYear,
    "reset-promotion": resetPromotion,
    "sync-raids": syncRaids,
    "save-ligue": saveLigue,
};
