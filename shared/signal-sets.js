'use strict';

const SignalSetType = {
    NORMAL: 'normal',
    COMPUTED: 'computed'
};

const SignalSetKind= {
    GENERIC: 'generic',
    TIME_SERIES: 'time_series'
};

// This value tells server it needs to choose ts signal
const SUBSTITUTE_TS_SIGNAL = '__substitute_ts_signal__';
const DEFAULT_TS_SIGNAL_CID = 'ts';

module.exports = {
    SignalSetType,
    SignalSetKind,
    SUBSTITUTE_TS_SIGNAL,
    DEFAULT_TS_SIGNAL_CID
};
