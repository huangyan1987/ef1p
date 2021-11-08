/*
Author: Kaspar Etter (https://kasparetter.com/)
Work: Explained from First Principles (https://ef1p.com/)
License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
*/

import { Color } from '../utility/color';
import { Button, ObjectButNotFunction, ValueOrArray, ValueOrFunction } from '../utility/types';

import { AllEntries, VersionedState, VersioningEvent } from './state';
import { Store } from './store';

export type ValueType = boolean | number | string | string[];
export type ErrorType = string | false;

export function equalValues(a?: any, b?: any): boolean {
    if (a === b) {
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }
    return false;
}

/**
 * Static entries can only be used to output information to the user.
 */
export interface Entry<T extends ValueType, State extends ObjectButNotFunction = {}> {
    readonly name: string;
    readonly description: ValueOrFunction<string, T>;
    defaultValue: ValueOrFunction<T>;
    outputColor?: ValueOrFunction<Color, T>;

    /**
     * Only used if the value type is a string array. Defaults to ', '.
     */
    readonly valueSeparator?: string;

    /**
     * Transforms the value for output.
     * The function is only called with a valid state.
     */
    readonly transform?: (value: T, state: State) => string;

    /**
     * Whether to skip the value in a list of outputs.
     * The function is only called with a valid state.
     */
    readonly skip?: (state: State, value: T) => boolean; // Order inverted to be compatible with the disabled type.
}

export const booleanInputTypes = ['checkbox', 'switch'] as const;
export type BooleanInputType = typeof booleanInputTypes[number];

export const numberInputTypes = ['number', 'range'] as const;
export type NumberInputType = typeof numberInputTypes[number];

export const stringInputTypes = ['text', 'textarea', 'select', 'password', 'date', 'color'] as const;
export type StringInputType = typeof stringInputTypes[number];

export const arrayInputTypes = ['multiple'] as const;
export type ArrayInputType = typeof arrayInputTypes[number];

export type InputType = BooleanInputType | NumberInputType | StringInputType | ArrayInputType;

/**
 * 'text' inputs provide suggestions based on their history.
 */
export const inputTypesWithHistory: InputType[] = ['text'];

/**
 * The input types whose 'onInput' handlers are triggered artificially.
 */
export const inputTypesWithArtificialOnInput: InputType[] = ['checkbox', 'switch', 'select', 'multiple'];

/**
 * Dynamic entries can be input by the user and thus have an associated state.
 */
export interface DynamicEntry<T extends ValueType, State extends ObjectButNotFunction = any> extends Entry<T, State> {
    /**
     * One of the above input types.
     */
    readonly inputType: InputType;

    /**
     * Width of the label in pixels.
     * Provide this only if you want to override the estimated label width.
     */
    readonly labelWidth?: number;

    /**
     * Width of the input field in pixels.
     */
    readonly inputWidth?: number;

    /**
     * Only relevant for 'textarea' inputs.
     */
    readonly rows?: number;

    /**
     * Only relevant for 'number', 'range', and 'date' inputs.
     * Defaults to 0 for 'range' inputs.
     */
    readonly minValue?: T;

    /**
     * Only relevant for 'number', 'range', and 'date' inputs.
     * Defaults to 100 for 'range' inputs.
     */
    readonly maxValue?: T;

    /**
     * Only relevant for 'number' and 'range' inputs.
     * Defaults to 1.
     */
    readonly stepValue?: T;

    /**
     * The placeholder of the input field.
     */
    readonly placeholder?: ValueOrFunction<string, State>;

    /**
     * The suggested values are added to the datalist but not to the history.
     * The function is called only with a valid state.
     */
    readonly suggestedValues?: ValueOrFunction<T[], State>;

    /**
     * Only relevant for 'select' inputs.
     * The function is called only with a valid state.
     */
    readonly selectOptions?: ValueOrFunction<Record<string, string>, State>;

    /**
     * Whether this input is read-only.
     */
    readonly readOnly?: boolean;

    /**
     * Determines whether this input is disabled.
     * The function is called with potentially invalid inputs.
     */
    readonly disable?: (inputs: State) => boolean;

    /**
     * The color of the input label.
     * The function is called with potentially invalid inputs.
     */
    inputColor?: (value: T, inputs: State) => Color;

    /**
     * Validates this input.
     * The function is called with a potentially invalid new state.
     */
    readonly validate?: (value: T, newState: State, oldState: State) => ErrorType;

    /**
     * Handles the up or down arrow keys on 'text' inputs.
     * The function is called with a potentially invalid value and potentially invalid inputs.
     * Please note that providing such a handler disables the history feature of 'text' inputs.
     */
    readonly onUpOrDown?: (event: 'up' | 'down', value: T, inputs: State) => T;

    /**
     * Only use onChange for reactions specific to this entry.
     * Otherwise use the meta property of the store.
     * The handlers are called only with a valid value and a valid state.
     *
     * @argument fromHistory Derived entries shouldn't be overwritten when stepping through the history.
     * @argument changeId This value allows callees to determine that the same change triggered several invocations of the same handler.
     */
    readonly onChange?: ValueOrArray<(newValue: T, newState: State, fromHistory: boolean, changeId: number) => any>;

    /**
     * For live updates based on the non-validated input value and the last valid state.
     * You likely also want to listen for changes as onInput is not triggered when stepping through the history.
     */
    readonly onInput?: ValueOrArray<(newValue: T, currentState: State, store: Store<VersionedState<State>, AllEntries<State>, VersioningEvent>) => any>;

    /**
     * Creates a button which the user can press in order to determine a suitable value for this entry.
     * The functions are called with the potentially invalid input value of this entry and a valid state.
     */
    readonly determine?: ValueOrArray<Button<T, Promise<[T, ErrorType]>, State>>;
}

export function isDynamicEntry<T extends ValueType, State extends ObjectButNotFunction = {}>(entry: Entry<T, State>): entry is DynamicEntry<T, State> {
    return (entry as DynamicEntry<T, State>).inputType !== undefined;
}
