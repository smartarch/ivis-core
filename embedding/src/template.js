'use strict';

export function embedTemplate(domElementId, ivisSandboxUrlBase, templateId, params, accessToken, callbacks) {
    function restCall(method, url, data, callback) {
        const xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = () => {
            if (xhttp.readyState === 4 && xhttp.status === 200) {
                callback(xhttp.responseText ? JSON.parse(xhttp.responseText) : undefined);
            }
        };
        xhttp.open(method, url);
        xhttp.setRequestHeader("Content-type", "application/json");

        xhttp.send(data ? JSON.stringify(data) : null);
    }

    function getAnonymousSandboxUrl(path) {
        return ivisSandboxUrlBase + 'anonymous/' + (path || '');
    }

    function getSandboxUrl(path) {
        return ivisSandboxUrlBase + accessToken + '/' + (path || '');
    }

    let refreshAccessTokenTimeout = null;
    const scheduleRefreshAccessToken = () => {
        refreshAccessTokenTimeout = setTimeout(() => {
            restCall('PUT', getSandboxUrl('rest/embedded-entity-renew-restricted-access-token'), {token: accessToken}, () => {
                scheduleRefreshAccessToken();
            });
        }, 30 * 1000);
    };
    scheduleRefreshAccessToken();


    restCall('GET', getSandboxUrl(`rest/templates/${templateId}`), null, template => {
        let contentNodeIsLoaded = false;

        const sendMessage = (type, data) => {
            if (contentNodeIsLoaded) { // This is to avoid errors "common.js:45744 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://localhost:8081') does not match the recipient window's origin ('http://localhost:3000')"
                contentNode.contentWindow.postMessage({type, data}, getSandboxUrl());
            }
        };

        const receiveMessage = evt => {
            const msg = evt.data;

            if (msg.type === 'initNeeded') {
                // It seems that sometime the message that the content node does not arrive. However if the content root notifies us, we just proceed
                contentNodeIsLoaded = true;

                const panel = {
                    "id": 0,
                    "name": "test embed template",
                    "description": "test emved template",
                    "workspace": 0,
                    "template": templateId,
                    "builtin_template": null,
                    "params": params,
                    "namespace": template.namespace,
                    "order": null,
                    "templateParams": template.settings.params,
                    "templateElevatedAccess": template.elevated_access,
                    "permissions": [
                        "edit",
                        "view"
                    ],
                    "orderBefore": 'none'
                };

                let templateTEST = {
                    "id": 4,
                    "name": " Line chart s horizontalnimi mezemi",
                    "description": " Line chart s horizontalnimi mezemi",
                    "type": "jsx",
                    "settings": {
                        "params": [
                            {
                                "id": "sigSet",
                                "label": "Signal Set",
                                "help": "Signal set for the sensors",
                                "type": "signalSet"
                            },
                            {
                                "id": "sig",
                                "label": "Sensor",
                                "type": "signal",
                                "signalSetRef": "sigSet"
                            },
                            {
                                "id": "label",
                                "label": "Label",
                                "type": "string"
                            },
                            {
                                "id": "color",
                                "label": "Color",
                                "type": "color"
                            },
                            {
                                "id": "unit",
                                "label": "Unit",
                                "type": "string"
                            },
                            {
                                "id": "yAxis",
                                "label": "Vertical Axis",
                                "type": "fieldset",
                                "children": [
                                    {
                                        "id": "label",
                                        "label": "Label",
                                        "type": "string"
                                    },
                                    {
                                        "id": "visible",
                                        "label": "Visible",
                                        "type": "boolean",
                                        "default": true
                                    },
                                    {
                                        "id": "yScale",
                                        "label": "Vertical Scale Limits",
                                        "help": "Settings of the vertical scale limits. Leave empty if limit is supposed to be calculated automatically",
                                        "type": "fieldset",
                                        "children": [
                                            {
                                                "id": "min",
                                                "label": "Minimum",
                                                "type": "number"
                                            },
                                            {
                                                "id": "max",
                                                "label": "Maximum",
                                                "type": "number"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ],
                        "jsx": "import React, {Component} from \"react\";\nimport styles from './styles.scss';\nimport {select} from \"d3-selection\";\nimport {rgb} from \"d3-color\";\nimport {withPanelConfig, TimeContext, TimeRangeSelector, LineChart} from \"ivis\";\n\n@withPanelConfig\nexport default class PanelContent extends Component {\n  constructor(props) {\n    super(props);\n    this.referenceLines = {};\n  }\n\n  render() {\n    const config = this.getPanelConfig();\n\n    const yScaleMin = parseInt(config.yAxis.yScale.min);\n    const yScaleMax = parseInt(config.yAxis.yScale.max);\n\n    const yScale = {};\n    if (!Number.isNaN(yScaleMin)) {\n      yScale.includedMin = yScaleMin;\n      yScale.limitMin = yScaleMin;\n    }\n\n    if (!Number.isNaN(yScaleMax)) {\n      yScale.includedMax = yScaleMax;\n      yScale.limitMax = yScaleMax;\n    }\n\n    const lineChartConfig = {\n      yAxes: [\n        {\n          label: config.yAxis.label,\n          visible: config.yAxis.visible,\n          ...yScale\n        }\n      ],\n      signalSets: [\n        {\n          cid: config.sigSet,\n          signals: [\n            {\n              cid: config.sig,\n              label: config.label,\n              color: config.color,\n              axis: 0,\n              unit: config.unit\n            }\n          ]\n        }\n      ]\n    };\n\n    return (\n      <TimeContext>\n        <div className=\"row\">\n          <div className=\"col-12\">\n            <TimeRangeSelector/>\n          </div>\n          <div className=\"col-12\">\n            <div>\n              <LineChart\n                config={lineChartConfig}\n                height={500}\n                margin={{ left: 60, right: 5, top: 5, bottom: 20 }}\n                withTooltip\n                tooltipExtraProps={{ width: 450 }}\n                getExtraQueries={(base, abs) => {\n                  return [\n                    {\n                      type: 'timeSeriesSummary',\n                      args: [\n                        {\n                          [config.sigSet]: {\n                            signals: {\n                              [config.sig]: [\n                                'avg',\n                                {\n                                  type: 'percentiles',\n                                  percents: [ 5.1, 95.10 ]\n                                }\n                              ]\n                            }\n                          }\n                        },\n                        abs\n                      ]\n                    }\n                  ];\n                }}\n                prepareExtraData={(base, signalSetsData, extraData) => {\n                  return {\n                    signalSetsSummary: extraData[0]\n                  };\n                }}\n                createChart={(base, signalSetsData, baseState, abs, xScale, yScales, points) => {\n                  const yScale = yScales[0];\n                  const data = baseState.signalSetsSummary[config.sigSet][config.sig];\n                  const updateLine = (id, value) => this.referenceLines[id]\n                    .attr('x1', xScale(abs.from))\n                    .attr('x2', xScale(abs.to))\n                    .attr('y1', yScale(value))\n                    .attr('y2', yScale(value));\n\n                  updateLine('lower', 3);\n                  updateLine('avg', data.avg);\n                  updateLine('upper', data.percentiles[95.10]);\n                }}\n                getGraphContent={(base, paths) => {\n                  return [\n                    (<g key={`referenceLines`}>\n                      <line ref={node => this.referenceLines['lower'] = select(node)} stroke=\"#006ac7\" strokeWidth=\"2\" strokeDasharray=\"2 2\"/>\n                      <line ref={node => this.referenceLines['avg'] = select(node)} stroke=\"#006ac7\" strokeWidth=\"2\"/>\n                      <line ref={node => this.referenceLines['upper'] = select(node)} stroke=\"#006ac7\" strokeWidth=\"2\" strokeDasharray=\"2 2\"/>\n                    </g>),\n                    ...paths\n                  ];\n                }}\n              />\n            </div>\n          </div>\n        </div>\n      </TimeContext>\n    );\n  }\n}",
                        "scss": ""
                    },
                    "state": 2,
                    "output": {
                        "errors": [],
                        "warnings": []
                    },
                    "created": "2019-06-14T17:53:34.000Z",
                    "namespace": 1,
                    "elevated_access": 1,
                    "permissions": [
                        "delete",
                        "edit",
                        "execute",
                        "manageFiles",
                        "share",
                        "view",
                        "viewFiles"
                    ]
                };
                const contentProps = {
                    panel: panel
                };

                sendMessage('init', {accessToken, contentProps});

            } else if (msg.type === 'rpcRequest') {
                const method = msg.data.method;
                const params = msg.data.params;

                let ret;

                if (method === 'navigateTo') {
                    if (callbacks && callbacks.navigateTo) {
                        callbacks.navigateTo(params.path);
                    }
                }

                sendMessage('rpcResponse', {msgId: msg.data.msgId, ret});

            } else if (msg.type === 'clientHeight') {
                contentNode.height = msg.data;
            }
        };

        window.addEventListener('message', receiveMessage, false);

        const contentNode = document.createElement('iframe');
        contentNode.src = getAnonymousSandboxUrl('panel');
        contentNode.style.border = '0px none';
        contentNode.style.width = '100%';
        contentNode.style.overflow = 'hidden';
        contentNode.onload = () => contentNodeIsLoaded = true;

        document.getElementById(domElementId).appendChild(contentNode);
    });
}
