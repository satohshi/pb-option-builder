# PocketBase Type-safe Option Builder

Option builder for [PocketBase JavaScript SDK](https://github.com/pocketbase/js-sdk), that also helps with typing the response.

This is how you would normally write options for the PocketBase SDK:

```js
{
    expand: 'comments_via_post,tags',
    fields: 'id,title,expand.comments_via_post.user,expand.comments_via_post.message,expand.tags.id,expand.tags.name'
}
```

Writing options manually like this is very error-prone, and makes the code very hard to read/maintain.

This option builder allows you to write it like this instead:

```js
{
    key: 'posts',
    fields: ['id', 'title'],
    expand: [
        { key: 'comments_via_post', fields: ['user', 'message'] },
        { key: 'tags', fields: ['id', 'name'] }
    ]
}
```

It comes with autocomplete for `key`, `fields`, `expand` and the basic `sort` options, and also provides you a way to **type the response**.

## Installation

```sh
npm install pb-option-builder
```

## Usage

### Defining schema and relations

Below is an example of how you would define the schema for [this](https://pocketbase.io/docs/working-with-relations/) in the PocketBase docs.

```ts
interface PocketbaseCollection {
	id: string
	created: string
	updated: string
}

interface User extends PocketBaseCollection {
	name: string
}

interface Post extends PocketBaseCollection {
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

// You need to use "type" instead of "interface" for these as interfaces are "mutable"
// TypeScript needs to know the keys are guaranteed to be of type "string"
type Schema = {
	// Table names as keys
	users: User
	posts: Post
	tags: Tag
	comments: Comment
}

type Relations = {
	// column names as keys
	user: User
	post: Post // if you have view collections, use union like "post: Post | ViewCollectionName"

	// if the relation is one-to-many or many-to-many, use Array<>
	tags: Array<Tag>

	// back-relations
	posts_via_tags: Array<Post>
	// OR
	'posts(tags)': Array<Post> // if you're using PB < 0.22.0
	// the old syntax will be supported until PB hard-deprecates it or it gets too annoying to maintain for whatever reason

	// Add "?" modifier to annotate optional relation fields
	comments_via_post?: Array<Comment> // i.e. post might not have any comments
	comments_via_user?: Array<Comment> // i.e. user might not have any comments
}
```

### Initializing builder

```ts
import { initializeBuilder } from 'pb-option-builder'

const optionBuilder = initializeBuilder<Schema, Relations>()
```

### Building query

```ts
const [optionsObj, typeObj] = optionBuilder({
	key: 'posts',
	// you can specify fields to be returned in the response
	fields: ['id', 'title', 'tags'],
	expand: [
		{
			key: 'tags',
			// returns all fields if not specified
		},
		{
			key: 'comments_via_post',
			// you can use :excerpt modifier on string fields
			fields: ['message:excerpt(20)'],
			// nesting "expand" is supported
			expand: [{ key: 'user', fields: ['name'] }],
		},
	],
})

const result = await pb.collection('posts').getOne(optionsObj)
```

### Typing response:

The second item in the returned array (`typeObj` in the example above) is an empty object type cast as the type of the response.  
You can use it to type the response:

```ts
const result = await pb.collection('posts').getOne<typeof typeObj>(optionsObj)
```

Now `result` will be correctly typed as:

```ts
Pick<Post, "tags" | "id" | "title"> & {
    expand: {
        tags: Array<Tag>
        comments_via_post?: (Pick<Comment, "message"> & {
            expand: {
                user: Pick<User, "name">
            }
        })[]
    }
}
```

It's a bit hacky and not very pretty, but does the job.

### Parameter type for the option builder:

```ts
{
    // Table name as defined in "Schema"
    key: keyof Schema

    // Array of fields you want to be returned in the response
    fields?: Array<keyof Schema[key]> // defaults to all fields if not specified

    // Array of relations you want to be returned in the response
    expand?: Array<ExpandItem>

    // These will be passed to the SDK as is
    sort?: string
    filter?: string
    requestKey?: string
}

ExpandItem {
    // Relation name as defined in "Relations"
    key: keyof Relations

    fields?: // same as above
    expand?: // same as above
}
```

### Fields

You might run into a situation where you have a component that requires a specific set of fields to be passed to it, and it makes sense to fetch the item directly in one route, but in another, it makes sense to do so through `expand`.

Because of the way the parameter for the option builder is structured, the `fields` array is portable.  
You can define the fields in one place, and use it either at the top level, or in the `expand` option **as is** .

Example:

```ts
// CommentBlock.svelte
export const commentFields = ['user', 'message'] satisfies Array<keyof Comment>
```

```ts
// [comment]/+page.ts
import { commentFields } from '$lib/CommentBlock.svelte'

const [optionsObj, typeObj] = optionBuilder({
	key: 'comments',
	// you can use the imported fields here
	fields: commentFields,
})
```

```ts
// [post]/+page.ts
import { commentFields } from '$lib/CommentBlock.svelte'

const [optionsObj, typeObj] = optionBuilder({
	key: 'posts',
	fields: ['id', 'title', 'tags'],
	expand: [
		{
			key: comments_via_post,
			// or here. No need to alter the imported fields
			fields: commentFields,
		},
	],
})
```

### Handling of optional relation fields

Let's say you want to get a post with its comments using `expand`.  
When the post doesn't have any comments, the SDK (or PocketBase itself rather) returns:

```ts
{
    id: "1",
    title: "Lorem ipsum",
    tags: ["lorem", "ipsum"],
    created: "2024-01-01T00:00:00.000Z",
    updated: "2024-01-01T00:00:00.000Z"
}
```

The response will not have

```ts
{
	expand: {
		comments_via_post: []
	}
}
// or not even { expand: undefined } for that matter
```

So you will get runtime error if you try to access `post.expand[comments_via_post]` on a post with no comments.

To handle cases like this, the option builder will add `?` modifier to the `expand` field itself if all the specified expands are for optional relation fields.

```ts
Post & {
    expand?: {
        comments_via_post: Comment[]
    }
}
// or with multiple optional relations
Post & {
    expand?: {
        foo?: Foo
        comments_via_post?: Comment[]
    }
}
```

If you expand it along with fields that are not optional like `tag`, `expand` will be there regardless of whether the post has comments or not.

So the respose will be typed as:

```ts
Post & {
    expand: {
        tag: Array<Tag>
        comments_via_post?: Comment[]
    }
}
```

## Caveat:

In order for back-relations to work, you need to have the forward-relations defined as well.

```ts
type Relations = {
	// This alone is not enough
	comments_via_post: Array<Comment>

	// You need to have this defined as well
	post: Post
}

const [optionsObj, typeObj] = optionBuilder({
	key: 'posts',
	expand: [
		{
			// Without "post: Post", TS will complain and you won't get autocomplete or typesafety
			key: 'comments_via_post',
		},
	],
})
```

## Why not just integrate this into the SDK?

-   This way, you can start using this in existing projects without having to change anything. I think most of the time, you don't need to pass in any options to the SDK, so installing a new custom SDK for a very few instances where you need to seems like an overkill.
-   There are many functionalities of the official SDK that I don't use or understand fully, and I don't want to maintain a fork of it just for this.
