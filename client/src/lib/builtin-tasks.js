"use strict";

import ivisConfig from "ivisConfig";

const builtinTasks = ivisConfig.builtinTasks;

export function getBuiltinTasks() {
    return builtinTasks;
}

export function getBuiltinTask(key) {
    return builtinTasks[key];
}

export function getBuiltinTaskName(key, t) {
    const builtinTask = builtinTasks[key];

    if (builtinTask) {
        return t(builtinTask.name);
    } else {
        return null;
    }
}

export function anyBuiltinTask() {
    return Object.keys(builtinTasks).length !== 0;
}
