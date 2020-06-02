import { BoundingBox, Box, BoxSide } from '../utility/box';
import { lineToTextDistance } from '../utility/constants';
import { Marker, markerAttributes, markerOffset } from '../utility/marker';
import { LineSide, Point } from '../utility/point';

import { Circle } from './circle';
import { VisualElement, VisualElementProps } from './element';
import { Ellipse } from './ellipse';
import { Alignment, HorizontalAlignment, Text, TextProps, VerticalAlignment } from './text';

export function determineAlignment(offset: Point): Alignment {
    const absoluteOffset = offset.absolute();
    let horizontalAlignment: HorizontalAlignment;
    if (absoluteOffset.y > absoluteOffset.x * 4) {
        horizontalAlignment = 'center';
    } else if (offset.x > 0) {
        horizontalAlignment = 'left';
    } else {
        horizontalAlignment = 'right';
    }
    let verticalAlignment: VerticalAlignment;
    if (absoluteOffset.x > absoluteOffset.y * 4) {
        verticalAlignment = 'center';
    } else if (offset.y > 0) {
        verticalAlignment = 'top';
    } else {
        verticalAlignment = 'bottom';
    }
    return { horizontalAlignment, verticalAlignment };
}

export interface LineProps extends VisualElementProps {
    start: Point;
    end: Point;
    marker?: Marker | Marker[];
}

export class Line extends VisualElement<LineProps> {
    public vector(): Point {
        return this.props.end.subtract(this.props.start);
    }

    public length(): number {
        return this.vector().length();
    }

    protected _boundingBox({ start, end }: LineProps): Box {
        return BoundingBox(start, end);
    }

    protected _encode(prefix: string, {
        start,
        end,
        marker,
        color,
    }: LineProps): string {
        start = start.round3();
        end = end.round3();
        return prefix + `<line${this.attributes()}`
            + ` x1="${start.x}"`
            + ` y1="${start.y}"`
            + ` x2="${end.x}"`
            + ` y2="${end.y}"`
            + markerAttributes(this.length.bind(this), marker, color)
            + `>${this.children(prefix)}</line>\n`;
    }

    public text(
        text: string | string[],
        side: LineSide = 'left',
        // Horizontal and vertical alignment are intentionally not excluded because the defaults should be overridable.
        props: Omit<TextProps, 'position' | 'text'> = {},
    ): Text {
        const offset = this.vector().rotate(side).normalize(lineToTextDistance);
        const position = this.center().add(offset);
        const color = this.props.color;
        return new Text({ position, text, ...determineAlignment(offset), color, ...props });
    }

    public shorten(startOffset: number, endOffset: number = startOffset): Line {
        const vector = this.vector();
        const start = this.props.start.add(vector.normalize(startOffset));
        const end = this.props.end.subtract(vector.normalize(endOffset));
        return new Line({ ...this.props, start, end }); // Overriding old start and end properties.
    }
}

export function ConnectionLine(
    startElement: VisualElement,
    startSide: BoxSide,
    endElement: VisualElement,
    endSide: BoxSide,
    props: Omit<LineProps, 'start' | 'end'> = {},
): Line {
    const marker = props.marker ?? 'end';
    const start = startElement.boundingBox().pointAt(startSide, markerOffset(marker, 'start'));
    const end = endElement.boundingBox().pointAt(endSide, markerOffset(marker, 'end'));
    return new Line({ start, end, marker, ...props });
}

export function DiagonalLine(
    startElement: Circle | Ellipse,
    endElement: Circle | Ellipse,
    props: Omit<LineProps, 'start' | 'end'> = {},
): Line {
    const marker = props.marker ?? 'end';
    const start = startElement.pointTowards(endElement.center(), markerOffset(marker, 'start'));
    const end = endElement.pointTowards(startElement.center(), markerOffset(marker, 'end'));
    return new Line({ start, end, marker, ...props });
}
