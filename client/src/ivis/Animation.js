import React, {Component} from "react";
import PropTypes from "prop-types";
import {ServerAnimation} from "./ServerAnimation";
import {ClientAnimation} from "./ClientAnimation";
import {controlGroups} from "../lib/media-controls";
import {TranslationContext} from "../lib/i18n";


class Animation extends Component {
    static propTypes = {
        params: PropTypes.object,
        panel: PropTypes.object,
        children: PropTypes.node,
        t: PropTypes.func,
    }

    constructor(props) {
        super(props);

        this.state = {
            animationConf: null,
        };
    }

    componentDidMount() {
        this.fetchAnimationConfig();
    }

    async fetchAnimationConfig() {
        // const res = await axios.get(getUrl('/rest/animation/' + this.props.params.animationId));
        const conf = {
            type: 'client',
            beginTs: Date.parse('2017-01-01T01:00:00.000Z'),
            endTs: Date.parse('2017-01-01T03:59:50.000Z'),

            interpolFunc: 'linear',
            refreshRate: 45,

            //client-specific
            minBufferedKeyframeCount: 3,
            maxBufferedKeyframeCount: 24,

            defaultPlaybackSpeedFactor: 1,

            sigSetCid: 'process1',
            signals: ['s1', 's2', 's3', 's4'],
            //client-specific

            //server-specific
            pollRate: 800,
            id: 'test',

            //server-specific

            controls: {
                jumpBackward: {
                    shiftMs: 2000,
                    enabled: true,
                },
                jumpForward: {
                    shiftMs: 2000,
                    enabled: true,
                },
                playPause: {
                    enabled: true,
                },
                stop: {
                    enabled: true,
                },
                playbackSpeed: {
                    enabled: true,
                    step: 0.25,
                    limits: [0.5, 2.5]
                },
                timeline: {
                    enabled: true,
                    relative: false,
                }
            },
        };

        const incorporatePanelConf = (animConf) => {
            for (let controlKey in this.props.params.controls) {
                const panelCtrlConf = this.props.params.controls[controlKey];
                const animCtrlConf = animConf.controls[controlKey];

                if (panelCtrlConf.enabled !== undefined) {
                    animCtrlConf.enabled = animCtrlConf.enabled && panelCtrlConf.enabled;
                }
            }

            return animConf;
        };

        const config = incorporatePanelConf(conf);
        this.setState({animationConf: config});
    }

    render() {
        if (this.state.animationConf) {
            const ControlGroup = controlGroups[this.props.params.controlGroup];
            const Context = this.state.animationConf.type === 'client' ? ClientAnimation : ServerAnimation;

            return (
                <Context config={this.state.animationConf}>
                    {this.props.params.controlsPlacement === 'before' && <ControlGroup animationConf={this.state.animationConf}/>}
                    {this.props.children}
                    {this.props.params.controlsPlacement === 'after' && <ControlGroup animationConf={this.state.animationConf}/>}
                </Context>
            );
        } else {
            return (
                <div>
                    <TranslationContext.Consumer>
                        {value => value('loading-1')}
                    </TranslationContext.Consumer>
                </div>
            );
        }
    }
}

export {
    Animation,
};
