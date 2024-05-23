'use strict';

import React from 'react';
import {I18nextProvider, withTranslation as withTranslationReact} from 'react-i18next';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ivisConfig from 'ivisConfig';

import {convertToFake, getLang} from '../../../shared/langs';
import {createComponentMixin} from "./decorator-helpers";

import lang_en_US_common from "../../../locales/en-US/common";

const resourcesCommon = {
    'en-US': lang_en_US_common,
    'fk-FK': convertToFake(lang_en_US_common)
};

const resources = {};
for (const lng of ivisConfig.enabledLanguages) {
    const langDesc = getLang(lng);
    resources[langDesc.longCode] = {
        common: resourcesCommon[langDesc.longCode]
    };
}

i18n
    .use(LanguageDetector)
    .init({
        resources,

        fallbackLng: ivisConfig.defaultLanguage,
        defaultNS: 'common',

        interpolation: {
            escapeValue: false // not needed for react
        },

        react: {
            wait: true
        },

        detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator'],
            lookupQuerystring: 'locale',
            lookupCookie: 'i18nextLng',
            lookupLocalStorage: 'i18nextLng',
            caches: ['localStorage', 'cookie']
        },

        whitelist: ivisConfig.enabledLanguages,
        load: 'currentOnly',

        debug: false
    });


export default i18n;


export const TranslationContext = React.createContext(null);

export const withTranslation = createComponentMixin({
    contexts: [{context: TranslationContext, propName: 't'}]
});


const TranslationContextProvider = withTranslationReact()(props => {
    return (
        <TranslationContext.Provider value={props.t}>
            {props.children}
        </TranslationContext.Provider>
    );
});

export function TranslationRoot(props) {
    return (
        <I18nextProvider i18n={ i18n }>
            <TranslationContextProvider>
                {props.children}
            </TranslationContextProvider>
        </I18nextProvider>
    );
}

export function tMark(key) {
    return key;
}
