# PocketBase Type-safe Option Builder

Option builder for [PocketBase JavaScript SDK](https://github.com/pocketbase/js-sdk), that also helps with typing the response.

This is how you would normally write options for the PocketBase SDK:
```js
{
	expand: 'comments(post),tags',
	fields: 'id,title,expand.comments(post).user,expand.comments(post).message,expand.tags.id,expand.tags.name'
}
```
Writing options manually like this is very error-prone and hard to read/maintain.

This option builder allows you to write it like this instead:
```js
{
	key: 'posts',
	fields: ['id', 'title'],
	expand: [
		{ key: 'comments(post)', fields: ['user', 'message'] },
		{ key: 'tags', fields: ['id', 'name'] }
	]
}
```
It comes with autocomplete for `key`, `fields` and `expand` options, and also provides you a way to **type the response**.


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
	post: Post
	user: User

	// if the relation is one-to-many or many-to-many, use Array<>
	tags: Array<Tag>

	// back-relations
	"posts(tags)": Array<Post>
	"comments(post)": Array<Comment>
	"comments(user)": Array<Comment>
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
	key: "posts",
	// you can specify fields to be returned in the response
	fields: ["id", "title", "tags"],
	expand: [
		{
			key: "tags",
			// returns all fields if it's not specified
		},
		{
			key: "comments(post)",
			// nesting "expand" is supported
			expand: [
				{
					key: "user",
					fields: ["name"]
				}
			]
		}
	]
})

const result = await pb.collection('posts').getOne(optionsObj);
```

### Typing response:

The second item in the returned array (`typeObj` in the example above) is an empty object type cast as the type of the response.  
You can use it to type the response:

```ts
const result = await pb.collection('posts').getOne<typeof typeObj>(optionsObj);
```

It's a bit hacky and not very pretty, but does the job.


### Parameter type for `optionBuilder`:
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


Because of the way the argument for the option builder is structured, the `fields` array is portable.  
You can define the fields in one place, and use it either at the top level, or in the `expand` option **as is** .

Example:

```ts
// CommentBlock.svelte
export const commentFields = ["user", "message"] satisfies keyof Comment
```

```ts
// [comment]/+page.ts
import { commentFields } from '$lib/CommentBlock.svelte'

const [optionsObj, typeObj] = optionBuilder({
	key: "comments",
	// you can use the imported fields here
	fields: commentFields
})
```

```ts
// [post]/+page.ts
import { commentFields } from '$lib/CommentBlock.svelte'

const [optionsObj, typeObj] = optionBuilder({
	key: "posts",
	fields: ["id", "title", "tags"],
	expand: [
		{
			key: "comments(post)",
			// or here. No need to alter the imported fields
			fields: commentFields
		}
	]
})
```

## Caveat:
In order for back-relations to work, you need to have the forward-relations defined as well.
```ts
type Relations = {
	// This alone is not enough
	"comments(post)": Array<Comment>

	// You need to have this defined as well
	post: Post
}

const [optionsObj, typeObj] = optionBuilder({
	key: "posts",
	expand: [
		{
			// Without "post: Post", TS will complain and you won't get autocomplete or typesafety
			key: "comments(post)",
		}
	]
})
```

## Why not just integrate this into the SDK?
- This way, you can start using this in existing projects without having to change anything. I think most of the time, you don't need to pass in any options to the SDK, so installing a new custom SDK for a very few instances where you need to seems like an overkill.
- There are many functionalities of the official SDK that I don't use or understand fully, and I don't want to maintain a fork of it just for this.
