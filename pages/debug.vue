<template>
  <div class="container mx-auto px-4 py-8">
    <h1>Debug Collection API</h1>

    <h2>All Projects:</h2>
    <pre>{{ JSON.stringify(projects, null, 2) }}</pre>

    <h2>Single Project Test:</h2>
    <pre>{{ JSON.stringify(singleProject, null, 2) }}</pre>
  </div>
</template>

<script setup>
// Test getting all projects
const { data: projects } = await useAsyncData("debug-projects", () =>
  queryCollection("projects").all()
);

// Test getting a single project
const { data: singleProject } = await useAsyncData("debug-single", () =>
  queryCollection("projects").path("/projects/blockchain-voting-system").first()
);

console.log("Debug all projects:", projects.value);
console.log("Debug single project:", singleProject.value);
</script>
