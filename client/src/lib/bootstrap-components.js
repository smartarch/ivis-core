'use strict';

import React, {Component} from 'react';
import {withTranslation} from "react-i18next";
import PropTypes from 'prop-types';
import {withAsyncErrorHandler, withErrorHandling} from './error-handling';
import {withComponentMixins} from "./decorator-helpers";
import moment from "moment";
import {withTranslationCustom} from "./i18n";

import JQuery from 'jquery'

@withComponentMixins([
    withTranslationCustom,
    withErrorHandling
])
export class DismissibleAlert extends Component {
    static propTypes = {
        severity: PropTypes.string.isRequired,
        onCloseAsync: PropTypes.func
    }

    @withAsyncErrorHandler
    onClose() {
        if (this.props.onCloseAsync) {
            this.props.onCloseAsync();
        }
    }

    render() {
        const t = this.props.t;

        return (
            <div className={`alert alert-${this.props.severity} alert-dismissible`} role="alert">
                <button type="button" className="btn-close" aria-label={t('close')} onClick={::this.onClose} />
                {this.props.children}
            </div>
        )
    }
}

export class Icon extends Component {
    static propTypes = {
        icon: PropTypes.string.isRequired,
        family: PropTypes.string,
        title: PropTypes.string,
        className: PropTypes.string
    }

    static defaultProps = {
        family: 'fas'
    }

    render() {
        const props = this.props;

        if (props.family === 'fas' || props.family === 'far') {
            return <i className={`${props.family} fa-${props.icon} ${props.className || ''}`} title={props.title}/>;
        } else {
            console.error(`Icon font family ${props.family} not supported. (icon: ${props.icon}, title: ${props.title})`)
            return null;
        }
    }
}

@withComponentMixins([
    withErrorHandling
])
export class Button extends Component {
    static propTypes = {
        onClickAsync: PropTypes.func,
        label: PropTypes.string,
        icon: PropTypes.string,
        iconTitle: PropTypes.string,
        className: PropTypes.string,
        title: PropTypes.string,
        type: PropTypes.string,
        disabled: PropTypes.bool
    }

    @withAsyncErrorHandler
    async onClick(evt) {
        if (this.props.onClickAsync) {
            evt.preventDefault();
            await this.props.onClickAsync(evt);
        }
    }

    render() {
        const props = this.props;

        let className = 'btn';
        if (props.className) {
            className = className + ' ' + props.className;
        }

        let type = props.type || 'button';

        let icon;
        if (props.icon) {
            icon = <Icon icon={props.icon} title={props.iconTitle}/>
        }

        let iconSpacer;
        if (props.icon && props.label) {
            iconSpacer = ' ';
        }

        return (
            <button type={type} className={className} onClick={::this.onClick} title={this.props.title} disabled={this.props.disabled}>{icon}{iconSpacer}{props.label}</button>
        );
    }
}

export class ButtonDropdown extends Component {
    static propTypes = {
        label: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        icon: PropTypes.string,
        className: PropTypes.string,
        buttonClassName: PropTypes.string,
        menuClassName: PropTypes.string
    }

    render() {
        const props = this.props;

        const className = 'btn-group' + (props.className ? ' ' + props.className : '');
        const buttonClassName = 'btn dropdown-toggle' + (props.buttonClassName ? ' ' + props.buttonClassName : '');
        const menuClassName = 'dropdown-menu' + (props.menuClassName ? ' ' + props.menuClassName : '');

        let icon;
        if (props.icon) {
            icon = <Icon icon={props.icon}/>
        }

        let iconSpacer;
        if (props.icon && props.label) {
            iconSpacer = ' ';
        }

        return (
            <div className={className}>
                <button type="button" className={buttonClassName} data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">{icon}{iconSpacer}{props.label}</button>
                <ul className={menuClassName}>{props.children}</ul>
            </div>
        );
    }
}

@withComponentMixins([
    withErrorHandling
])
export class ActionLink extends Component {
    static propTypes = {
        onClickAsync: PropTypes.func,
        className: PropTypes.string,
        href: PropTypes.string
    }

    @withAsyncErrorHandler
    async onClick(evt) {
        if (this.props.onClickAsync) {
            evt.preventDefault();
            evt.stopPropagation();

            await this.props.onClickAsync(evt);
        }
    }

    render() {
        const props = this.props;

        return (
            <a href={props.href || ''} className={props.className} onClick={::this.onClick}>{props.children}</a>
        );
    }
}


export class DropdownActionLink extends Component {
    static propTypes = {
        onClickAsync: PropTypes.func,
        className: PropTypes.string,
        disabled: PropTypes.bool
    }

    render() {
        const props = this.props;

        let clsName = "dropdown-item ";
        if (props.disabled) {
            clsName += "disabled ";
        }

        if (props.className !== undefined) {
            clsName += props.className;
        }

        return (
            <ActionLink className={clsName} onClickAsync={props.onClickAsync}>{props.children}</ActionLink>
        );
    }
}


/** The `DropdownActionLink` closes the dropdown when clicked (because `evt.stopPropagation()` does not work correctly
 *  with React events). Use this component if you need the Dropdown to remain opened when action link is clicked. */
@withComponentMixins([
    withErrorHandling
])
export class DropdownActionLinkKeepOpen extends Component {
    static propTypes = {
        onClickAsync: PropTypes.func,
        className: PropTypes.string,
        disabled: PropTypes.bool
    }

    @withAsyncErrorHandler
    onClick(evt) {
        if (this.props.onClickAsync) {
            evt.preventDefault();
            evt.stopPropagation();

            this.props.onClickAsync(evt);
        }
    }

    componentDidMount() {
        this.element.addEventListener('click', ::this.onClick);
    }

    componentWillUnmount() {
        this.element.removeEventListener('click', ::this.onClick);
    }

    render() {
        const props = this.props;

        let clsName = "dropdown-item ";
        if (props.disabled) {
            clsName += "disabled ";
        }

        clsName += props.className;

        return (
            <a href={props.href || ''}  className={clsName} ref={node => this.element = node}>{props.children}</a>
        );
    }
}


export class DropdownDivider extends Component {
    static propTypes = {
        className: PropTypes.string
    }

    render() {
        const props = this.props;

        let className = 'dropdown-divider';
        if (props.className) {
            className = className + ' ' + props.className;
        }

        return (
            <div className={className}/>
        );
    }
}


@withComponentMixins([
    withTranslationCustom,
    withErrorHandling
])
export class ModalDialog extends Component {
    constructor(props) {
        super(props);
        this.state = { isShown: !props.hidden };
        this.modalRef = React.createRef();
    }

    static propTypes = {
        title: PropTypes.string,
        onCloseAsync: PropTypes.func,
        onButtonClickAsync: PropTypes.func,
        buttons: PropTypes.array,
        hidden: PropTypes.bool,
        className: PropTypes.string
    }

    /*
      this.props.hidden - this is the desired state of the modal
      this.hidden - this is the actual state of the modal - this is because there is no public API on Bootstrap modal to know whether the modal is shown or not
     */
    componentDidMount() {
        const modalElement = this.modalRef.current;
        this.modalInstance = new bootstrap.Modal(modalElement, {
            keyboard: false
        });

        if (this.state.isShown) {
            this.modalInstance.show();
        } else {
            this.modalInstance.hide();
        }

        modalElement.addEventListener('hidden.bs.modal', this.onHide);
    }

    componentDidUpdate(prevProps) {
        if (this.props.hidden !== prevProps.hidden) {
            this.setState({ isShown: !this.props.hidden }, () => {
                this.state.isShown ? this.modalInstance.show() : this.modalInstance.hide();
            });
        }
    }

    componentWillUnmount() {
        this.modalInstance.dispose();
    }

    onHide = () => {
        // Hide event is emited is both when hidden through user action or through API. We have to let the API
        // calls through, otherwise the modal would never hide. The user actions, which change the desired state,
        // are capture, converted to onClose callback and prevented. It's up to the parent to decide whether to
        // hide the modal or not.
        this.setState({ isShown: false });
        if (this.props.onCloseAsync) {
            this.props.onCloseAsync();
        }
    }

    @withAsyncErrorHandler
    async onClose() {
        if (this.props.onCloseAsync) {
            await this.props.onCloseAsync();
        }
    }

    async onButtonClick(idx) {
        const buttonSpec = this.props.buttons[idx];
        if (buttonSpec.onClickAsync) {
            await buttonSpec.onClickAsync(idx);
        }
    }

    renderButtons() {
        return this.props.buttons.map((buttonSpec, idx) => {
            return (
                <button
                    key={idx}
                    className={buttonSpec.className}
                    onClick={() => this.onButtonClick(idx)}
                >
                    {buttonSpec.label}
                </button>
            );
        });
    }

    render() {
        const { className, title, children } = this.props;

        let modalClassName = `modal fade ${className || ''}`;
        if (this.state.isShown) {
            modalClassName += ' show d-block';
        }

        return (
            <div
                ref={this.modalRef}
                className={modalClassName}
                tabIndex="-1"
                role="dialog"
                aria-labelledby="myModalLabel"
                aria-hidden={!this.state.isShown}
                style={{ display: this.state.isShown ? 'block' : 'none' }}
            >
                <div className="modal-dialog" role="document">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h4 className="modal-title">{title}</h4>
                            <button type="button" className="close" aria-label="Close" onClick={this.onClose}>
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div className="modal-body">{children}</div>
                        {this.props.buttons && (
                            <div className="modal-footer">
                                {this.renderButtons()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

/**
 * Simple react component that renders date-time. Renders relative time (e.g. 2 days ago) if the difference between now and timeStamp
 * is less than thresholdDays. Renders exact time (e.g. 2020-10-25 14:23:11) otherwise.
 */
export class RelativeTime extends Component {
    static propTypes = {
        timeStamp: PropTypes.string.isRequired,
        thresholdDays: PropTypes.number
    }
    static defaultProps = {
        thresholdDays: 100
    }

    render() {
        const ts = this.props.timeStamp;
        const td = this.props.thresholdDays;
        const relative = moment(ts).fromNow();
        const exact = moment(ts).format('YYYY-MM-DD HH:mm:ss');

        if (moment().diff(ts, 'days') < td) return <span title = {exact}>{relative}</span>;
        else return <span title = {relative}>{exact}</span>;
    }
}
