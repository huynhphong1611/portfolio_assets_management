---
name: fullstack_implementation
description: Best practices for implementing React + Firebase and Python backend proxy.
---

# Fullstack Implementation Guidelines

## React Architecture
1. Keep components small, modular, and single-responsibility.
2. Hooks go in `src/hooks`, utilities in `src/utils`, database logic in `src/services`.
3. Use Context API or unified state management (like Zustand) to prevent prop drilling.

## CSS & Styling
1. The project uses Custom CSS (Vanilla). Avoid messy inline styles.
2. Inject modern design patterns: subtle box-shadows, sleek gradients, transitions for hover effects.
3. Ensure UI logic never blocks the main thread.

## Firebase Firestore
1. Always use batch writes for multiple entry updates.
2. Handle offline states and error catches for Firestore promises.
