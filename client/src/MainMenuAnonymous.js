'use strict';

import React, {Component} from "react";
import {getLanguageChooser} from "./lib/page";
import {withComponentMixins} from "./lib/decorator-helpers";
import {withTranslationCustom} from "./lib/i18n";
import {withTranslation} from "react-i18next";

@withComponentMixins([
    withTranslationCustom
])
export default class MainMenu extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const t = this.context;

        return (
            <ul className="navbar-nav ivis-navbar-nav-right">
                {getLanguageChooser(t)}
            </ul>
        );
    }
}
