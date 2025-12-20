import * as version from "./version";
import * as register from "./register";
import * as resetAll from "./resetAll";
import * as resetPoints from "./resetPoints";
import * as profile from "./profile";
import * as launch from "./launch";
import * as assignRole from "./assignRole";
import * as setPoints from "./setPoints";
import * as setPointsBackup from "./setPointsBackup";

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
};
