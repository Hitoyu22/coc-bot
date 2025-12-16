import * as version from "./version";
import * as register from "./register";
import * as resetAll from "./resetAll";
import * as resetPoints from "./resetPoints";
import * as profile from "./profile";

export const commands = {
    version,
    register,
    "reset-all": resetAll,
    "reset-points": resetPoints,
    profile
};
