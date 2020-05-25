import React, {Component} from "react";
import PropTypes from "prop-types";
import {ServerAnimation} from "./ServerAnimation";
import {ClientAnimation} from "./ClientAnimation";
import {controlGroups} from "../lib/media-controls";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withAnimationData} from "../lib/animation-helpers";


class Animation extends Component {
    static propTypes = {
        config: PropTypes.object,
        children: PropTypes.node,
    }

    render() {
        const ControlGroup = controlGroups[this.props.config.controlGroup];
        const Context = this.props.config.type === 'client' ? ClientAnimation : ServerAnimation;

        return (
            <Context config={this.props.config}>
                {this.props.config.controlsPlacement === 'before' && <ControlGroup animationConf={this.props.config}/>}
                {this.props.children}
                {this.props.config.controlsPlacement === 'after' && <ControlGroup animationConf={this.props.config}/>}
            </Context>
        );
    }
}

@withComponentMixins([withAnimationData])
class AnimationContent extends Component {
    static propTypes = {
        width: PropTypes.string,
        height: PropTypes.string,
        margin: PropTypes.string,
        className: PropTypes.string,

        message: PropTypes.string,
        render: PropTypes.func,
        animationData: PropTypes.object,
    }

    render() {
        const isLoading = this.props.animationData === null;

        return (
            <div
                className={this.props.className}
                style={{
                    width: this.props.width,
                    height: this.props.height,
                    margin: this.props.margin,
                    textAling: "center",
                }}>

                { isLoading
                    &&
                        <h3
                            style={{
                                width: "100%"
                            }}>
                            {this.props.message}
                        </h3>
                    ||
                        this.props.render({animationData: this.props.animationData})
                }


            </div>
        );
    }
}

export {
    Animation,
    AnimationContent,
};
