<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Hero Section -->
    <div
      class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="container mx-auto px-4 py-12">
        <!-- Breadcrumb -->
        <nav class="mb-8">
          <ol
            class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400"
          >
            <li>
              <NuxtLink
                to="/"
                class="hover:text-gray-700 dark:hover:text-gray-300"
              >
                Home
              </NuxtLink>
            </li>
            <li class="flex items-center">
              <ChevronRight class="mx-2 h-4 w-4" />
              <NuxtLink
                to="/projects"
                class="hover:text-gray-700 dark:hover:text-gray-300"
              >
                Projects
              </NuxtLink>
            </li>
            <li class="flex items-center">
              <ChevronRight class="mx-2 h-4 w-4" />
              <span class="text-gray-900 dark:text-white">{{
                project?.title
              }}</span>
            </li>
          </ol>
        </nav>

        <!-- Project Header -->
        <div class="max-w-4xl">
          <!-- Status and Featured Badges -->
          <div class="flex items-center gap-3 mb-4">
            <Badge
              v-if="project?.featured"
              class="bg-primary/10 text-primary hover:bg-primary/20"
            >
              <Star class="mr-1 h-3 w-3" />
              Featured Project
            </Badge>

            <Badge :class="getStatusClasses(project?.status)">
              {{ project?.status }}
            </Badge>
          </div>

          <!-- Title and Description -->
          <h1
            class="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4"
          >
            {{ project?.title }}
          </h1>

          <p class="text-xl text-gray-600 dark:text-gray-400 mb-6">
            {{ project?.description }}
          </p>

          <!-- Project Meta -->
          <div
            class="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mb-8"
          >
            <div class="flex items-center">
              <Calendar class="mr-2 h-4 w-4" />
              {{ formatDate(project?.date) }}
            </div>

            <div v-if="project?.technologies?.length" class="flex items-center">
              <Code class="mr-2 h-4 w-4" />
              {{ project.technologies.length }} Technologies
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-wrap gap-3">
            <Button v-if="project?.github" variant="outline" size="lg" as-child>
              <NuxtLink :to="project.github" external target="_blank">
                <Github class="mr-2 h-4 w-4" />
                View Source Code
              </NuxtLink>
            </Button>

            <Button v-if="project?.demo" size="lg" as-child>
              <NuxtLink :to="project.demo" external target="_blank">
                <Globe class="mr-2 h-4 w-4" />
                Live Demo
              </NuxtLink>
            </Button>

            <Button variant="outline" size="lg" as-child>
              <NuxtLink to="/projects">
                <ArrowLeft class="mr-2 h-4 w-4" />
                Back to Projects
              </NuxtLink>
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="container mx-auto px-4 py-12">
      <div class="max-w-none lg:max-w-4xl mx-auto">
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <!-- Sidebar -->
          <div class="lg:col-span-1 order-2 lg:order-1">
            <div class="sticky top-8 space-y-6">
              <!-- Technologies -->
              <Card v-if="project?.technologies?.length" class="p-6">
                <h3
                  class="text-lg font-semibold text-gray-900 dark:text-white mb-4"
                >
                  Technologies Used
                </h3>
                <div class="flex flex-wrap gap-2">
                  <Badge
                    v-for="tech in project.technologies"
                    :key="tech"
                    variant="secondary"
                  >
                    {{ tech }}
                  </Badge>
                </div>
              </Card>

              <!-- Table of Contents -->
              <Card v-if="toc?.links?.length" class="p-6">
                <h3
                  class="text-lg font-semibold text-gray-900 dark:text-white mb-4"
                >
                  Table of Contents
                </h3>
                <nav class="space-y-2">
                  <a
                    v-for="link in toc.links"
                    :key="link.id"
                    :href="`#${link.id}`"
                    class="block text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
                    :class="{
                      'pl-4': link.depth === 3,
                      'pl-8': link.depth === 4,
                    }"
                  >
                    {{ link.text }}
                  </a>
                </nav>
              </Card>

              <!-- Project Image -->
              <Card v-if="project?.image" class="p-6">
                <h3
                  class="text-lg font-semibold text-gray-900 dark:text-white mb-4"
                >
                  Project Preview
                </h3>
                <NuxtImg
                  :src="project.image"
                  :alt="project.title"
                  class="w-full rounded-lg bg-gray-100 dark:bg-gray-700"
                  loading="lazy"
                  @error="handleImageError"
                />
              </Card>
            </div>
          </div>

          <!-- Content -->
          <div class="lg:col-span-3 order-1 lg:order-2">
            <article class="prose prose-lg dark:prose-invert max-w-none">
              <ContentRenderer
                v-if="project"
                :value="project"
                class="nuxt-content"
              />
            </article>

            <!-- Navigation -->
            <div
              class="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700"
            >
              <div class="flex justify-between items-center">
                <div>
                  <NuxtLink
                    v-if="prev"
                    :to="prev.path"
                    class="group flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    <ArrowLeft
                      class="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform"
                    />
                    <div>
                      <div class="text-xs uppercase tracking-wide">
                        Previous
                      </div>
                      <div class="font-medium">{{ prev.title }}</div>
                    </div>
                  </NuxtLink>
                </div>

                <div class="text-right">
                  <NuxtLink
                    v-if="next"
                    :to="next.path"
                    class="group flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    <div>
                      <div class="text-xs uppercase tracking-wide">Next</div>
                      <div class="font-medium">{{ next.title }}</div>
                    </div>
                    <ArrowRight
                      class="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform"
                    />
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChevronRight,
  Star,
  Calendar,
  Code,
  Github,
  Globe,
  ArrowLeft,
  ArrowRight,
} from "lucide-vue-next";

const route = useRoute();
const href = route.href;

console.log(href);

// Try fetching using filename comparison instead of path
const { data: project } = await useAsyncData(`project-${href}`, () =>
  queryCollection("projects").where("path", "=", `${href}`).first()
);

// Handle 404
if (!project.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Project not found",
  });
}

// Get table of contents - for now we'll disable this as it needs to be adapted
// const { data: toc } = await useAsyncData(`project-toc-${slug}`, () =>
//   queryContent("/projects")
//     .where({ _path: `/projects/${slug}` })
//     .only(["body"])
//     .findOne()
//     .then((doc) => doc?.body?.toc || null)
// );
const toc = ref(null);

// Get all projects for navigation using the collection API
const { data: allProjects } = await useAsyncData("all-projects", () =>
  queryCollection("projects")
    .select("title", "path", "date")
    .order("date", "DESC")
    .all()
);

const currentIndex = allProjects.value?.findIndex((p) => p.path === href);
const prev = currentIndex > 0 ? allProjects.value[currentIndex - 1] : null;
const next =
  currentIndex < allProjects.value.length - 1
    ? allProjects.value[currentIndex + 1]
    : null;

// SEO Meta
useSeoMeta({
  title: `${project.value?.title} | CS Portfolio`,
  description: project.value?.description,
  ogTitle: `${project.value?.title} | CS Portfolio`,
  ogDescription: project.value?.description,
  ogImage: project.value?.image,
  ogType: "article",
  articlePublishedTime: project.value?.date,
  articleModifiedTime: project.value?.date,
  articleAuthor: "Your Name",
  articleSection: "Technology",
  articleTag: project.value?.technologies?.join(", "),
});

// Methods
const formatDate = (dateString) => {
  if (!dateString) return "";
  const options = { year: "numeric", month: "long", day: "numeric" };
  return new Date(dateString).toLocaleDateString("en-US", options);
};

const getStatusClasses = (status) => {
  const statusStyles = {
    completed:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "in-progress":
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    planning: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    archived: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };
  return (
    statusStyles[status] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  );
};

const handleImageError = (event) => {
  event.target.src =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4=";
  event.target.classList.add("opacity-50");
};
</script>

<style>
@reference "tailwindcss";

/* Custom styles for Nuxt Content */
.nuxt-content {
  color: var(--color-foreground);
}

.nuxt-content h1,
.nuxt-content h2,
.nuxt-content h3,
.nuxt-content h4 {
  color: var(--color-foreground);
  @apply font-bold;
  @apply border-b border-gray-200 dark:border-gray-700 pb-2 mb-4;
}

.nuxt-content h1 {
  @apply text-3xl mt-8 mb-6;
}

.nuxt-content h2 {
  @apply text-2xl mt-8 mb-4;
}

.nuxt-content h3 {
  @apply text-xl mt-6 mb-3;
}

.nuxt-content h4 {
  @apply text-lg mt-4 mb-2;
}

.nuxt-content p {
  @apply mb-4 leading-relaxed;
}

.nuxt-content ul,
.nuxt-content ol {
  @apply mb-4 pl-6;
}

.nuxt-content li {
  @apply mb-2;
}

.nuxt-content strong {
  @apply font-semibold text-gray-900 dark:text-gray-100;
}

.nuxt-content code {
  @apply bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-sm font-mono;
}

.nuxt-content pre {
  @apply bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4;
}

.nuxt-content pre code {
  @apply bg-transparent px-0 py-0;
}

.nuxt-content blockquote {
  @apply border-l-4 border pl-4 italic text-gray-600 dark:text-gray-400 mb-4;
}

.nuxt-content a {
  color: var(--color-foreground);
  @apply hover:text-primary underline decoration-gray-400 dark:decoration-gray-500 hover:decoration-gray-600 dark:hover:decoration-gray-300;
}

.nuxt-content img {
  @apply rounded-lg shadow-lg mx-auto mb-4 max-w-full h-auto;
}

.nuxt-content table {
  @apply w-full border-collapse border border-gray-300 dark:border-gray-600 mb-4;
}

.nuxt-content th,
.nuxt-content td {
  @apply border border-gray-300 dark:border-gray-600 px-4 py-2 text-left;
}

.nuxt-content th {
  @apply bg-gray-100 dark:bg-gray-800 font-semibold;
}
</style>
