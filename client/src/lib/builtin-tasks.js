"use strict";

import ivisConfig from "ivisConfig";

const builtinTasks = ivisConfig.builtinTasks;

export function getBuiltinTasks() {
    return builtinTasks;
}

export function getBuiltinTask(taskId) {
    return builtinTasks.find(task => task.id === taskId);
}

export function anyBuiltinTask() {
    return builtinTasks.length !== 0;
}
