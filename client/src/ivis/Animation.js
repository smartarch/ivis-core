import React, {Component} from "react";
import PropTypes from "prop-types";
import {ServerAnimation} from "./ServerAnimation";
import {ClientAnimation} from "./ClientAnimation";
import {controlGroups} from "../lib/media-controls";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withAnimationData, withAnimationStatus} from "../lib/animation-helpers";


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

@withComponentMixins([withAnimationData, withAnimationStatus])
class AnimationContent extends Component {
    static propTypes = {
        width: PropTypes.string,
        height: PropTypes.string,
        margin: PropTypes.string,
        className: PropTypes.string,

        message: PropTypes.string,
        render: PropTypes.func,
        animationData: PropTypes.object,
        animationStatus: PropTypes.object,
    }

    render() {
        const isLoading = this.props.animationData === null;
        const message = !!this.props.animationStatus.error ? String(this.props.animationStatus.error) : this.props.message;

        return (
            <div
                className={this.props.className}
                style={{
                    width: this.props.width,
                    height: this.props.height,
                    margin: this.props.margin,
                }}>

                { isLoading
                    &&
                        <h3
                            style={{
                                width: "100%",
                                textAlign: "center",
                                lineHeight: this.props.height,
                            }}>
                            {message}
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
