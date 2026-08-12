// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import './RunCard.renderCell.scss'

import * as React from 'react'

import { ActionProps } from './Viewer.Types';
import {Link} from './AzureDevOpsUi'
import { Result } from 'sarif'
import {safeLinkHref} from './SafeLink'

const emptyPng = require('./assets/empty.png')
const vsCodePng = require('./assets/vscode-icon.png')
const vsPng = require('./assets/vs-icon.png')

const images = {
    empty: emptyPng,
    vscode: vsCodePng,
    vs: vsPng
}

function renderAction(props: ActionProps) {
    const { text, linkUrl, imageName, className } = props
	const href = safeLinkHref(linkUrl)
	if (!href) return <>{text}</>
    return <Link href={href} target="_blank" rel="noopener noreferrer" className={className}>
            <img src={images[imageName ?? 'empty']} alt={text} />
            {text}
        </Link>
}

export function renderActionsCell(result: Result) {
    return result.actions?.map((actionProps, index) => <div className="action" key={`${actionProps.text}-${index}`}>{renderAction(actionProps)}</div>);
}
