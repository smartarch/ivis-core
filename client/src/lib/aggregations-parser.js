
export function toIntervalString(interval) {
    let unit = '';
    let mod = 1;

    const dayMod = 24 * 60 * 60;
    const hourMod = 60 * 60;
    const minMod = 60;

    if (interval % dayMod === 0) {
        unit = 'd';
        mod = dayMod;
    } else if (interval % hourMod === 0) {
        unit = 'h';
        mod = hourMod;
    } else if (interval % minMod === 0) {
        unit = 'm';
        mod = minMod;
    }
    return (interval / mod) + unit;
}

export function fromIntervalStringToSeconds(intervalStr) {
    intervalStr = intervalStr.trim();
    const unit = intervalStr.slice(-1);
    let value = intervalStr.slice(0, -1);
    // modifier is unit to seconds
    let modifier = 1;
    switch (unit) {
        case 'd':
            modifier = 24 * 60 * 60;
            break;

        case 'h':
            modifier = 60 * 60;
            break;

        case 'm':
            modifier = 60;
            break;

        case 's':
            modifier = 1;
            break;

        default:
            // No units, just number
            value = intervalStr;
            break;
    }

    return value * modifier;
}
