# Database Documentation

## Green Leaf International School & College

> Database technology will be selected and configured in Phase 5.

---

## Planned Collections/Tables

### Users (Admin)
- id
- name
- email
- password (hashed)
- role (super_admin, admin, editor)
- createdAt
- updatedAt

### Home Content
- id
- heroHeading
- heroDescription
- heroImage
- ctaText
- ctaLink
- features (array)
- videoUrl
- updatedAt

### About
- id
- introduction
- vision
- mission
- principalMessage
- philosophy
- updatedAt

### Academics
- id
- curriculum
- approach
- programs (array)
- updatedAt

### Admissions
- id
- introduction
- process (array)
- requirements (array)
- importantInfo
- updatedAt

### Gallery
- id
- title
- caption
- imageUrl
- category
- isPublished
- createdAt
- updatedAt

### News
- id
- title
- slug
- excerpt
- content
- imageUrl
- isPublished
- publishedAt
- createdAt
- updatedAt

### Videos
- id
- title
- youtubeUrl
- thumbnail
- isPublished
- createdAt
- updatedAt

### Contact
- id
- name
- email
- phone
- subject
- message
- isRead
- createdAt

### Settings
- id
- key
- value
- updatedAt
