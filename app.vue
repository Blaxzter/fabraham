<template>
  <div>
    <NuxtRouteAnnouncer />

    <!-- Header -->
    <header
      class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50"
    >
      <div class="container mx-auto px-4">
        <div class="flex items-center justify-between h-16">
          <!-- Logo/Title -->
          <div class="flex items-center">
            <NuxtLink
              to="/"
              class="text-xl font-bold text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300"
            >
              CS Portfolio
            </NuxtLink>
          </div>

          <!-- Navigation -->
          <nav class="hidden md:flex items-center space-x-8">
            <NuxtLink
              to="/"
              class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Home
            </NuxtLink>
            <NuxtLink
              to="/projects"
              class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Projects
            </NuxtLink>
            <a
              href="/#about"
              class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              About
            </a>
          </nav>

          <!-- Theme Toggle -->
          <div class="flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main>
      <NuxtPage />
    </main>
  </div>
</template>
