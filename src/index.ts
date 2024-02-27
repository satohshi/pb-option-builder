interface PocketBaseOption {
	fields?: string
	expand?: string
	sort?: string
	filter?: string
	requestKey?: string
}

type BaseSchema = Record<string, unknown>
type BaseRelation<T extends BaseSchema> = Record<string, T[keyof T] | Array<T[keyof T]>>

type WithEllipsis = '' | `${',' | ', '}${boolean}`
type Modifier = `:excerpt(${number}${WithEllipsis})`

type RemoveModifier<T extends string> = T extends `${infer U}:${string}` ? U : T
type FieldsArrayToUnion<T> = T extends Array<string> ? RemoveModifier<T[number]> : T

type Option<TSchema extends BaseSchema, TRelation extends BaseRelation<TSchema>> = {
	[Key in keyof TSchema]: {
		key: Key
		fields?: Array<
			keyof {
				[K in keyof TSchema[Key] as TSchema[Key][K] extends string
					? `${K & string}${'' | Modifier}`
					: K]: unknown
			}
		>
		expand?: Array<Expand<TSchema, TRelation, Related<TSchema, TRelation, TSchema[Key]>>>

		sort?: '@random' | `${'' | '-'}${keyof TSchema[Key] & string}` | (string & {})
		filter?: string
		requestKey?: string
	}
}[keyof TSchema]

type Expand<
	TSchema extends BaseSchema,
	TRelation extends BaseRelation<TSchema>,
	TKey extends keyof TRelation
> = {
	[Key in TKey]: {
		key: Key
		fields?: NonNullable<TRelation[Key]> extends Array<infer U> | infer U
			? Array<
					{
						[K in keyof U]: U[K] extends string ? `${K & string}${'' | Modifier}` : K
					}[keyof U]
				>
			: never
		expand?: NonNullable<TRelation[Key]> extends Array<infer U extends TSchema[keyof TSchema]>
			? Array<Expand<TSchema, TRelation, Related<TSchema, TRelation, U>>>
			: NonNullable<TRelation[Key]> extends infer U extends TSchema[keyof TSchema]
				? Array<Expand<TSchema, TRelation, Related<TSchema, TRelation, U>>>
				: never

		// Build fails with this simpler syntax due to a bug in esbuild (fixed in v0.19.12 but dependency is not updated yet in tsup and vitest)
		// expand?: NonNullable<TRelation[Key]> extends
		// 	| Array<infer U extends TSchema[keyof TSchema]>
		// 	| infer U extends TSchema[keyof TSchema]
		// 	? Array<Expand<TSchema, TRelation, Related<TSchema, TRelation, U>>>
		// 	: never
	}
}[TKey]

type Related<TSchema, TRelation, T extends TSchema[keyof TSchema]> =
	| (keyof T & keyof TRelation)
	| BackRelation<TSchema, TRelation, T>

type BackRelation<TSchema, TRelation, T extends TSchema[keyof TSchema]> = keyof {
	[Key in keyof TRelation as Key extends `${string}(${infer U})` | `${string}_via_${infer U}`
		? U extends keyof TRelation
			? TRelation[U] extends T
				? Key
				: never
			: never
		: never]: unknown
} &
	keyof TRelation

type ResponseType<
	TSchema extends BaseSchema,
	TRelation extends BaseRelation<TSchema>,
	TOption extends Option<TSchema, TRelation>,
	_Obj = TSchema[TOption['key']]
> = (FieldsArrayToUnion<TOption['fields']> extends infer Fields extends keyof _Obj
	? Pick<_Obj, Fields>
	: _Obj) &
	ProcessExpandArray<TSchema, TRelation, TOption['expand']>

// check if all items in "expand" array are optional
type AllOptional<TRelation, T extends Array<{ key: keyof TRelation }>> = {
	[Obj in T[number] as Obj['key']]: undefined extends TRelation[Obj['key']] ? true : false
} extends Record<PropertyKey, true>
	? true
	: false

type ProcessExpandArray<
	TSchema extends BaseSchema,
	TRelation extends BaseRelation<TSchema>,
	TExpandArr
> = TExpandArr extends Array<Expand<TSchema, TRelation, keyof TRelation>>
	? AllOptional<TRelation, TExpandArr> extends true
		? {
				expand?: TExpandArr['length'] extends 1
					? // if there's only one expand, whether "expand" is undefined or not depends on that single expand
						{
							[E in TExpandArr[number] as E['key']]: ProcessSingleExpand<
								TSchema,
								TRelation,
								E
							>
						}
					: // if there's more than one expand, we still need to check if each item is undefined or not, even after checking "expand" is not undefined
						{
							[E in TExpandArr[number] as E['key']]?: ProcessSingleExpand<
								TSchema,
								TRelation,
								E
							>
						}
			}
		: {
				// if there's expand item that we know for sure isn't undefined, we don't need to +? on "expand" itself
				expand: {
					// AFAIK, there's no way to add "?" modifier conditionally, so we have to use keys from TRelation
					[Key in keyof TRelation as Key extends TExpandArr[number]['key']
						? Key
						: never]: {
						[E in TExpandArr[number] as E['key']]: ProcessSingleExpand<
							TSchema,
							TRelation,
							E
						>
					}[Key]
				}
			}
	: unknown // "never" doesn't work here because "any & never" is never

type HandleArray<T, IsArray extends boolean> = IsArray extends true ? Array<T> : T

type ProcessSingleExpand<
	TSchema extends BaseSchema,
	TRelation extends BaseRelation<TSchema>,
	TExpand extends Expand<TSchema, TRelation, keyof TRelation>,
	_Obj = NonNullable<TRelation[TExpand['key']]> extends Array<infer U> | infer U ? U : never
> = HandleArray<
	(FieldsArrayToUnion<TExpand['fields']> extends infer Fields extends keyof _Obj
		? Pick<_Obj, Fields>
		: _Obj) &
		ProcessExpandArray<TSchema, TRelation, TExpand['expand']>,
	NonNullable<TRelation[TExpand['key']]> extends Array<unknown> ? true : false
>

// Less "strict" version of Option so that we don't have to pass generics down to helper functions
type HelperArg = { key: string; fields?: string[]; expand?: HelperArg[] }

// baseKey includes "." at the end so that we don't have to check if it's the top level or not
const getFields = (option: HelperArg, baseKey = ''): string => {
	const { fields, expand } = option

	let fieldsAtThisLevel: string
	if (fields) {
		fieldsAtThisLevel = fields.map((field) => `${baseKey}${field}`).join(',')
	} else {
		// if it doesn't expand any further, there's no need to add ".*"
		fieldsAtThisLevel = expand ? `${baseKey}*` : baseKey.slice(0, -1)
	}

	if (expand) {
		// check if any of the expand has fields specified
		if (JSON.stringify(expand).includes('"fields"')) {
			const expandFields = expand.map((exp) => {
				const fieldsAtDeeperLevel = getFields(exp, `${baseKey}expand.${exp.key}.`)
				return fieldsAtDeeperLevel
			})
			return `${fieldsAtThisLevel},${expandFields.join(',')}`
		}
		// if not, add ".*" to include all fields at this level and below
		return `${fieldsAtThisLevel},${baseKey}expand.*`
	}

	return `${fieldsAtThisLevel}`
}

const getExpand = (option: HelperArg[], baseKey = ''): string => {
	const res = option
		.map((exp) => {
			const { key, expand } = exp
			if (expand) {
				return `${getExpand(expand, `${baseKey}${key}.`)}`
			}
			return `${baseKey}${key}`
		})
		.join(',')
	return res
}

export const initializeBuilder =
	<TSchema extends BaseSchema, TRelations extends BaseRelation<TSchema>>() =>
	<const T extends Option<TSchema, TRelations>>(
		option: T
	): [PocketBaseOption, ResponseType<TSchema, TRelations, T>] => {
		const { sort, filter, requestKey } = option

		let fields: string | undefined = undefined
		if (JSON.stringify(option).includes('"fields"')) {
			fields = getFields(option as HelperArg)
		}

		let expand: string | undefined = undefined
		if (option.expand) {
			expand = getExpand(option.expand as HelperArg[])
		}

		const res = { fields, expand, sort, filter, requestKey }

		// remove undefined values. it'll cause error if left unhandled
		for (const key in res) {
			if (!res[key as keyof typeof res]) {
				delete res[key as keyof typeof res]
			}
		}

		return [res, {} as any]
	}
