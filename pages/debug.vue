<template>
  <div class="container mx-auto px-4 py-8">
    <h1>Debug Collection API</h1>

    <h2>All Projects:</h2>
    <pre>{{ JSON.stringify(projects, null, 2) }}</pre>

    <h2>Single Project Test:</h2>
    <pre>{{ JSON.stringify(singleProject, null, 2) }}</pre>

    <div class="mt-8 p-4 bg-gray-100 rounded-lg">
      <h3 class="text-lg font-semibold mb-2">Light Debugger</h3>
      <p class="text-gray-700">
        The Light Debugger is now integrated into the main Controls Panel. To
        access it:
      </p>
      <ol class="list-decimal list-inside mt-2 text-gray-700">
        <li>Go to any page with the 3D scene (like the home page)</li>
        <li>Click the Settings icon in the top-right corner</li>
        <li>Switch to the "Lights" tab</li>
        <li>Use the controls to manipulate lights in real-time</li>
      </ol>
    </div>
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
