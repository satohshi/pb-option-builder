import { describe, expect, expectTypeOf, it } from 'vitest'
import { initializeBuilder } from './index.js'

interface PocketBaseCollection {
	id: string
	created: string
	updated: string
}

interface User extends PocketBaseCollection {
	name: string
}

interface Post extends PocketBaseCollection {
	user: string
	title: string
	tags: Array<string>
}

interface Tag extends PocketBaseCollection {
	name: string
}

interface Comment extends PocketBaseCollection {
	post: string
	user: string
	message: string
}

type Schema = {
	users: User
	posts: Post
	tags: Tag
	comments: Comment
}

type Relations = {
	post: Post
	user: User
	tags?: Array<Tag>

	posts_via_tags?: Array<Post>
	posts_via_user?: Array<Post>
	comments_via_post?: Array<Comment>
	comments_via_user?: Array<Comment>
}

describe('builder', () => {
	const builder = initializeBuilder<Schema, Relations>()

	it('returns empty object if no option is specified', () => {
		const [optionObj, typeObj] = builder({ key: 'posts' })
		expect(optionObj).toEqual({})
		expectTypeOf(typeObj).toEqualTypeOf<Post>()
	})

	// unhandled option keys
	it('passes "sort" to the SDK as is', () => {
		const [optionObj, typeObj] = builder({ key: 'posts', sort: 'title' })
		expect(optionObj).toEqual({ sort: 'title' })
		expectTypeOf(typeObj).toEqualTypeOf<Post>()
	})

	it('passes "filter" to the SDK as is', () => {
		const [optionObj, typeObj] = builder({ key: 'posts', filter: 'title != ""' })
		expect(optionObj).toEqual({ filter: 'title != ""' })
		expectTypeOf(typeObj).toEqualTypeOf<Post>()
	})

	it('passes "requestKey" to the SDK as is', () => {
		const [optionObj, typeObj] = builder({ key: 'posts', requestKey: 'a' })
		expect(optionObj).toEqual({ requestKey: 'a' })
		expectTypeOf(typeObj).toEqualTypeOf<Post>()
	})

	// fields & expand
	it('handles fields at top level correctly without expand', () => {
		const [optionObj, typeObj] = builder({ key: 'posts', fields: ['id', 'title'] })
		expect(optionObj).toEqual({ fields: 'id,title' })
		expectTypeOf(typeObj).toEqualTypeOf<Pick<Post, 'id' | 'title'>>()
	})

	it('handles single expand correctly', () => {
		const [optionObj1, typeObj1] = builder({
			key: 'posts',
			expand: [{ key: 'comments_via_post' }],
		})
		expect(optionObj1).toEqual({ expand: 'comments_via_post' })
		expectTypeOf(typeObj1).toEqualTypeOf<Post & { expand?: { comments_via_post: Comment[] } }>()

		const [optionObj2, typeObj2] = builder({ key: 'posts', expand: [{ key: 'tags' }] })
		expect(optionObj2).toEqual({ expand: 'tags' })
		expectTypeOf(typeObj2).toEqualTypeOf<Post & { expand?: { tags: Tag[] } }>()
	})

	it('handles fields with single expand correctly', () => {
		// fields specified at top level, but not in expand level
		const [optionObj1, typeObj1] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [{ key: 'comments_via_post' }],
		})
		expect(optionObj1).toEqual({
			expand: 'comments_via_post',
			fields: 'id,title,expand.*',
		})
		expectTypeOf(typeObj1).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand?: { comments_via_post: Comment[] }
			}
		>()

		// fields specified in expand, but not at top level
		const [optionObj2, typeObj2] = builder({
			key: 'posts',
			expand: [{ key: 'comments_via_post', fields: ['id', 'message'] }],
		})
		expect(optionObj2).toEqual({
			expand: 'comments_via_post',
			fields: '*,expand.comments_via_post.id,expand.comments_via_post.message',
		})
		expectTypeOf(typeObj2).toEqualTypeOf<
			Post & {
				expand?: { comments_via_post: Pick<Comment, 'id' | 'message'>[] }
			}
		>()

		// fields specified at both top level and in expand
		const [optionObj3, typeObj3] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [{ key: 'comments_via_post', fields: ['id', 'message'] }],
		})
		expect(optionObj3).toEqual({
			expand: 'comments_via_post',
			fields: 'id,title,expand.comments_via_post.id,expand.comments_via_post.message',
		})
		expectTypeOf(typeObj3).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand?: { comments_via_post: Pick<Comment, 'id' | 'message'>[] }
			}
		>()
	})

	it('handles multiple expand correctly on the same level', () => {
		const [optionObj1, typeObj1] = builder({
			key: 'posts',
			expand: [{ key: 'comments_via_post' }, { key: 'tags' }],
		})
		expect(optionObj1).toEqual({ expand: 'comments_via_post,tags' })
		expectTypeOf(typeObj1).toEqualTypeOf<
			Post & {
				expand?: { comments_via_post?: Comment[]; tags?: Tag[] }
			}
		>()
	})

	it('handles fields with multiple expand correctly', () => {
		// fields specified at top level, but not in expand level
		const [optionObj1, typeObj1] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [{ key: 'comments_via_post' }, { key: 'tags' }],
		})
		expect(optionObj1).toEqual({
			expand: 'comments_via_post,tags',
			fields: 'id,title,expand.*',
		})
		expectTypeOf(typeObj1).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand?: { comments_via_post?: Comment[]; tags?: Tag[] }
			}
		>()

		// fields specified in one expand, but not at top level
		const [optionObj2, typeObj2] = builder({
			key: 'posts',
			expand: [{ key: 'comments_via_post', fields: ['id', 'message'] }, { key: 'tags' }],
		})
		expect(optionObj2).toEqual({
			expand: 'comments_via_post,tags',
			fields: '*,expand.comments_via_post.id,expand.comments_via_post.message,expand.tags',
		})
		expectTypeOf(typeObj2).toEqualTypeOf<
			Post & {
				expand?: { comments_via_post?: Pick<Comment, 'id' | 'message'>[]; tags?: Tag[] }
			}
		>()

		// fields specified in both expands, but not at top level
		const [optionObj3, typeObj3] = builder({
			key: 'posts',
			expand: [
				{ key: 'comments_via_post', fields: ['id', 'message'] },
				{ key: 'tags', fields: ['id', 'name'] },
			],
		})
		expect(optionObj3).toEqual({
			expand: 'comments_via_post,tags',
			fields: '*,expand.comments_via_post.id,expand.comments_via_post.message,expand.tags.id,expand.tags.name',
		})
		expectTypeOf(typeObj3).toEqualTypeOf<
			Post & {
				expand?: {
					comments_via_post?: Pick<Comment, 'id' | 'message'>[]
					tags?: Pick<Tag, 'id' | 'name'>[]
				}
			}
		>()

		// fields specified both at top level and in expand
		const [optionObj4, typeObj4] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [
				{ key: 'comments_via_post', fields: ['id', 'message'] },
				{ key: 'tags', fields: ['id', 'name'] },
			],
		})
		expect(optionObj4).toEqual({
			expand: 'comments_via_post,tags',
			fields: 'id,title,expand.comments_via_post.id,expand.comments_via_post.message,expand.tags.id,expand.tags.name',
		})
		expectTypeOf(typeObj4).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand?: {
					comments_via_post?: Pick<Comment, 'id' | 'message'>[]
					tags?: Pick<Tag, 'id' | 'name'>[]
				}
			}
		>()

		// One expand field is required, the other is optional
		const [optionObj5, typeObj5] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [
				{ key: 'comments_via_post', fields: ['id', 'message'] },
				{ key: 'user', fields: ['id', 'name'] },
			],
		})
		expect(optionObj5).toEqual({
			expand: 'comments_via_post,user',
			fields: 'id,title,expand.comments_via_post.id,expand.comments_via_post.message,expand.user.id,expand.user.name',
		})
		expectTypeOf(typeObj5).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand: {
					comments_via_post?: Pick<Comment, 'id' | 'message'>[]
					user: Pick<User, 'id' | 'name'>
				}
			}
		>()
	})

	it('handles multi-layer expand correctly', () => {
		const [optionObj1, typeObj1] = builder({
			key: 'posts',
			expand: [{ key: 'comments_via_post', expand: [{ key: 'user' }] }, { key: 'tags' }],
		})
		expect(optionObj1).toEqual({
			expand: 'comments_via_post.user,tags',
		})
		expectTypeOf(typeObj1).toEqualTypeOf<
			Post & {
				expand?: {
					comments_via_post?: (Comment & { expand: { user: User } })[]
					tags?: Tag[]
				}
			}
		>()

		const [optionObj2, typeObj2] = builder({
			key: 'users',
			expand: [
				{
					key: 'posts_via_user',
					expand: [
						{ key: 'comments_via_post', expand: [{ key: 'user' }] },
						{ key: 'tags' },
					],
				},
			],
		})
		expect(optionObj2).toEqual({
			expand: 'posts_via_user.comments_via_post.user,posts_via_user.tags',
		})
		expectTypeOf(typeObj2).toEqualTypeOf<
			User & {
				expand?: {
					posts_via_user: (Post & {
						expand?: {
							comments_via_post?: (Comment & {
								expand: {
									user: User
								}
							})[]
							tags?: Tag[]
						}
					})[]
				}
			}
		>()
	})

	it('handles fields with multi-layer expand correctly', () => {
		// fields specified at top level, but not in expand level
		const [optionObj1, typeObj1] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [{ key: 'tags' }, { key: 'comments_via_post', expand: [{ key: 'user' }] }],
		})
		expect(optionObj1).toEqual({
			expand: 'tags,comments_via_post.user',
			fields: 'id,title,expand.*',
		})
		expectTypeOf(typeObj1).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand?: {
					tags?: Tag[]
					comments_via_post?: (Comment & { expand: { user: User } })[]
				}
			}
		>()

		// fields specified in the deepest expand only
		const [optionObj2, typeObj2] = builder({
			key: 'posts',
			expand: [
				{ key: 'tags' },
				{ key: 'comments_via_post', expand: [{ key: 'user', fields: ['id', 'name'] }] },
			],
		})
		expect(optionObj2).toEqual({
			expand: 'tags,comments_via_post.user',
			fields: '*,expand.tags,expand.comments_via_post.*,expand.comments_via_post.expand.user.id,expand.comments_via_post.expand.user.name',
		})
		expectTypeOf(typeObj2).toEqualTypeOf<
			Post & {
				expand?: {
					tags?: Tag[]
					comments_via_post?: (Comment & {
						expand: {
							user: Pick<User, 'id' | 'name'>
						}
					})[]
				}
			}
		>()

		// fields specified in all expands, but not at top level
		const [optionObj3, typeObj3] = builder({
			key: 'posts',
			expand: [
				{ key: 'tags', fields: ['id', 'name'] },
				{
					key: 'comments_via_post',
					fields: ['id', 'message'],
					expand: [{ key: 'user', fields: ['id', 'name'] }],
				},
			],
		})
		expect(optionObj3).toEqual({
			expand: 'tags,comments_via_post.user',
			fields: '*,expand.tags.id,expand.tags.name,expand.comments_via_post.id,expand.comments_via_post.message,expand.comments_via_post.expand.user.id,expand.comments_via_post.expand.user.name',
		})
		expectTypeOf(typeObj3).toEqualTypeOf<
			Post & {
				expand?: {
					tags?: Pick<Tag, 'id' | 'name'>[]
					comments_via_post?: (Pick<Comment, 'id' | 'message'> & {
						expand: {
							user: Pick<User, 'id' | 'name'>
						}
					})[]
				}
			}
		>()

		// fields specified in all levels
		const [optionObj4, typeObj4] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [
				{ key: 'tags', fields: ['id', 'name'] },
				{
					key: 'comments_via_post',
					fields: ['id', 'message'],
					expand: [{ key: 'user', fields: ['id', 'name'] }],
				},
			],
		})
		expect(optionObj4).toEqual({
			expand: 'tags,comments_via_post.user',
			fields: 'id,title,expand.tags.id,expand.tags.name,expand.comments_via_post.id,expand.comments_via_post.message,expand.comments_via_post.expand.user.id,expand.comments_via_post.expand.user.name',
		})
		expectTypeOf(typeObj4).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand?: {
					tags?: Pick<Tag, 'id' | 'name'>[]
					comments_via_post?: (Pick<Comment, 'id' | 'message'> & {
						expand: {
							user: Pick<User, 'id' | 'name'>
						}
					})[]
				}
			}
		>()

		// fields specified in all levels except the deepest
		const [optionObj5, typeObj5] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [
				{ key: 'tags', fields: ['id', 'name'] },
				{ key: 'comments_via_post', fields: ['id', 'message'], expand: [{ key: 'user' }] },
			],
		})
		expect(optionObj5).toEqual({
			expand: 'tags,comments_via_post.user',
			fields: 'id,title,expand.tags.id,expand.tags.name,expand.comments_via_post.id,expand.comments_via_post.message,expand.comments_via_post.expand.*',
		})
		expectTypeOf(typeObj5).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand?: {
					tags?: Pick<Tag, 'id' | 'name'>[]
					comments_via_post?: (Pick<Comment, 'id' | 'message'> & {
						expand: {
							user: User
						}
					})[]
				}
			}
		>()

		// fields specified in all levels except one of the middle level
		const [optionObj6, typeObj6] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [
				{ key: 'tags', fields: ['id', 'name'] },
				{ key: 'comments_via_post', expand: [{ key: 'user', fields: ['id', 'name'] }] },
			],
		})
		expect(optionObj6).toEqual({
			expand: 'tags,comments_via_post.user',
			fields: 'id,title,expand.tags.id,expand.tags.name,expand.comments_via_post.*,expand.comments_via_post.expand.user.id,expand.comments_via_post.expand.user.name',
		})
		expectTypeOf(typeObj6).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand?: {
					tags?: Pick<Tag, 'id' | 'name'>[]
					comments_via_post?: (Comment & {
						expand: {
							user: Pick<User, 'id' | 'name'>
						}
					})[]
				}
			}
		>()
	})

	it('ignores modifiers like :excerpt', () => {
		const [optionObj, typeObj] = builder({
			key: 'posts',
			fields: ['id', 'title:excerpt(200, true)'],
		})
		expect(optionObj).toEqual({ fields: 'id,title:excerpt(200, true)' })
		expectTypeOf(typeObj).toEqualTypeOf<Pick<Post, 'id' | 'title'>>()

		const [optionObj2, typeObj2] = builder({
			key: 'posts',
			fields: ['id', 'title'],
			expand: [{ key: 'comments_via_post', fields: ['id', 'message:excerpt(200)'] }],
		})
		expect(optionObj2).toEqual({
			expand: 'comments_via_post',
			fields: 'id,title,expand.comments_via_post.id,expand.comments_via_post.message:excerpt(200)',
		})
		expectTypeOf(typeObj2).toEqualTypeOf<
			Pick<Post, 'id' | 'title'> & {
				expand?: { comments_via_post: Pick<Comment, 'id' | 'message'>[] }
			}
		>()
	})
})
