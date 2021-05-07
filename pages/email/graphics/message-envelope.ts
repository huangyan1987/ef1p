import { doubleTextMargin, strokeWidth, textMargin } from '../../../code/svg/utility/constants';
import { P } from '../../../code/svg/utility/point';

import { VisualElement } from '../../../code/svg/elements/element';
import { Line } from '../../../code/svg/elements/line';
import { Rectangle } from '../../../code/svg/elements/rectangle';
import { printSVG } from '../../../code/svg/elements/svg';
import { bold, calculateTextHeight, estimateTextSizeWithMargin, preserveWhitespace, T, TextLine, uppercase } from '../../../code/svg/elements/text';

const gap = 40;
const size = estimateTextSizeWithMargin(['Mail client', 'of', 'alice@example.org']);
const messageWidth = 240;
const envelopeMargin = 2 * strokeWidth;
const alignment = { horizontalAlignment: 'left', verticalAlignment: 'top' } as const;

const messageTitle: TextLine = bold('Message');
export const messageFromAlice: TextLine = 'From: Alice <alice@example.org>';
export const messageToBob: TextLine = 'To: Bob <bob@example.com>';
export const messageCcCarol: TextLine = 'Cc: Carol <carol@example.com>';
export const messageBccIetf: TextLine = T('Bcc: ', uppercase('ietf'), ' <ietf@ietf.org>');
export const messageBccCarol: TextLine = 'Bcc: Carol <carol@example.com>';
export const messageBccDavid: TextLine = 'Bcc: David <david@example.net>';
export const messageBccBoth1: TextLine = 'Bcc: Carol <carol@example.com>,';
export const messageBccBoth2: TextLine = T(preserveWhitespace('          '), 'David <david@example.net>');
export const messageBccEmpty: TextLine = 'Bcc:';
export const messageLines = [messageFromAlice, messageToBob, messageCcCarol];

const envelopeTitle: TextLine = bold('Envelope');
export const envelopeFromAlice: TextLine = 'MAIL FROM:<alice@example.org>';
export const envelopeToBob: TextLine = 'RCPT TO:<bob@example.com>';
export const envelopeToCarol: TextLine = 'RCPT TO:<carol@example.com>';
export const envelopeToCaroline: TextLine = 'RCPT TO:<caroline@example.net>';
export const envelopeToIetf: TextLine = 'RCPT TO:<ietf@ietf.org>';
export const envelopeFromAdmin: TextLine = 'MAIL FROM:<admin@ietf.org>';
export const envelopeToDavid: TextLine = 'RCPT TO:<david@example.net>';

export const clientAlice: TextLine[] = [T(bold('Mail client'), ' of'), 'alice@example.org'];
export const outgoingExampleOrg: TextLine[] = [bold('Outgoing'), bold('mail server'), 'of example.org'];
export const incomingExampleOrg: TextLine[] = [bold('Incoming'), bold('mail server'), 'of example.org'];
export const incomingExampleCom: TextLine[] = [bold('Incoming'), bold('mail server'), 'of example.com'];
export const incomingExampleNet: TextLine[] = [bold('Incoming'), bold('mail server'), 'of example.net'];
export const incomingIetfOrg: TextLine[] = [bold('Incoming'), bold('mail server'), 'of ietf.org'];

export function printEnvelope(
    left: TextLine[],
    right: TextLine[],
    envelope: TextLine[],
    message: TextLine[] = messageLines,
): void {
    const elements = new Array<VisualElement>();

    const leftBox = new Rectangle({ position: P(0, -size.y / 2), size });
    elements.push(leftBox, leftBox.text(left));

    const messageLines = [messageTitle, ...message];
    const messageSize = P(messageWidth, calculateTextHeight(messageLines)).add(doubleTextMargin);

    const envelopeLines = [envelopeTitle, ...envelope];
    const envelopeSize = P(
        messageSize.x + 2 * envelopeMargin,
        messageSize.y + calculateTextHeight(envelopeLines) + doubleTextMargin.y + 3 * envelopeMargin,
    );

    const envelopeBox = new Rectangle({
        position: P(size.x + gap, -envelopeSize.y / 2),
        size: envelopeSize,
        cornerRadius: 0,
        color: 'green',
        classes: 'angular',
    });
    elements.push(envelopeBox, envelopeBox.text(envelopeLines, alignment, textMargin.add(P(envelopeMargin, envelopeMargin))));

    const messageBox = new Rectangle({
        position: P(size.x + gap + envelopeMargin, envelopeSize.y / 2 - envelopeMargin - messageSize.y),
        size: messageSize,
        cornerRadius: 0,
        color: 'blue',
        classes: 'angular',
    });
    elements.push(messageBox, messageBox.text(messageLines, alignment));

    const rightBox = new Rectangle({ position: P(size.x + 2 * gap + envelopeSize.x, -size.y / 2), size });
    elements.push(rightBox, rightBox.text(right));

    elements.unshift(Line.connectBoxes(leftBox, 'right', envelopeBox, 'left', { color: 'green', marker: [] }));
    elements.unshift(Line.connectBoxes(envelopeBox, 'right', rightBox, 'left', { color: 'green' }));

    printSVG(...elements);
}