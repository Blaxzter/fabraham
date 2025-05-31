<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Header Section -->
    <div class="text-center mb-12">
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        My Computer Science Projects
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        A timeline of my journey through various computer science projects, from
        web development to machine learning and blockchain technologies.
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="text-center py-12">
      <Loader2 class="w-8 h-8 animate-spin mx-auto mb-4" />
      <p class="text-gray-600 dark:text-gray-400">Loading projects...</p>
    </div>
    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <AlertTriangle class="w-8 h-8 text-red-500 mx-auto mb-4" />
      <p class="text-red-600 dark:text-red-400">
        Failed to load projects. Please try again later.
      </p>
      {{ error }}
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Timeline -->
      <div class="relative">
        <!-- Vertical line -->
        <div
          class="absolute left-1/2 transform -translate-x-1/2 w-0.5 bg-gray-300 dark:bg-gray-600 h-full"
        />

        <!-- Projects -->
        <div class="space-y-12">
          <div
            v-for="(project, index) in projects"
            :key="project.path"
            class="relative flex items-center"
            :class="index % 2 === 0 ? 'justify-start' : 'justify-end'"
          >
            <!-- Timeline dot -->
            <div
              class="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-primary-500 rounded-full border-4 border-white dark:border-gray-900 z-10"
            />

            <!-- Project Card -->
            <div
              class="w-5/12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
              :class="
                index % 2 === 0 ? 'mr-auto text-left' : 'ml-auto text-right'
              "
            >
              <!-- Project Image -->
              <div v-if="project.image" class="mb-4">
                <NuxtImg
                  :src="project.image"
                  :alt="project.title"
                  class="w-full aspect-[16/9] object-cover rounded-lg bg-gray-100 dark:bg-gray-700"
                  loading="lazy"
                  @error="handleImageError"
                />
              </div>

              <!-- Featured Badge -->
              <Badge v-if="project.featured" variant="default" class="mb-3">
                Featured
              </Badge>

              <!-- Status Badge -->
              <Badge
                :variant="getStatusVariant(project.status) as any"
                class="mb-3 ml-2"
              >
                {{ project.status }}
              </Badge>

              <!-- Date -->
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {{ formatDate(project.date) }}
              </p>

              <!-- Title -->
              <h3
                class="text-xl font-semibold text-gray-900 dark:text-white mb-2"
              >
                {{ project.title }}
              </h3>

              <!-- Description -->
              <p class="text-gray-600 dark:text-gray-300 mb-4">
                {{ project.description }}
              </p>

              <!-- Technologies -->
              <div
                class="flex flex-wrap gap-2 mb-4"
                :class="index % 2 === 0 ? 'justify-start' : 'justify-end'"
              >
                <Badge
                  v-for="tech in project.technologies"
                  :key="tech"
                  variant="secondary"
                  class="text-xs"
                >
                  {{ tech }}
                </Badge>
              </div>

              <!-- Action Buttons -->
              <div
                class="flex gap-2"
                :class="index % 2 === 0 ? 'justify-start' : 'justify-end'"
              >
                <Button variant="default" size="sm" as-child>
                  <NuxtLink :to="project.path">
                    <Eye class="w-4 h-4 mr-1" />
                    View Details
                  </NuxtLink>
                </Button>

                <Button
                  v-if="project.github"
                  variant="outline"
                  size="sm"
                  as-child
                >
                  <a
                    :href="project.github"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github class="w-4 h-4 mr-1" />
                    GitHub
                  </a>
                </Button>

                <Button
                  v-if="project.demo"
                  variant="outline"
                  size="sm"
                  as-child
                >
                  <a
                    :href="project.demo"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe class="w-4 h-4 mr-1" />
                    Demo
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects Grid View Toggle -->
      <div class="mt-16 text-center">
        <Button variant="outline" size="lg" @click="toggleView">
          <LayoutGrid v-if="viewMode === 'timeline'" class="w-5 h-5 mr-2" />
          <Clock v-else class="w-5 h-5 mr-2" />
          {{
            viewMode === "timeline"
              ? "Switch to Grid View"
              : "Switch to Timeline View"
          }}
        </Button>
      </div>

      <!-- Grid View (Alternative) -->
      <div
        v-if="viewMode === 'grid'"
        class="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <Card
          v-for="project in projects"
          :key="project.path"
          class="hover:shadow-lg transition-shadow duration-300"
        >
          <CardHeader>
            <div v-if="project.image" class="aspect-video">
              <NuxtImg
                :src="project.image"
                :alt="project.title"
                class="w-full aspect-[16/9] object-cover bg-gray-100 dark:bg-gray-700"
                loading="lazy"
                @error="handleImageError"
              />
            </div>
          </CardHeader>

          <CardContent class="space-y-3">
            <div class="flex items-center gap-2">
              <Badge v-if="project.featured" variant="default">
                Featured
              </Badge>
              <Badge :variant="getStatusVariant(project.status) as any">
                {{ project.status }}
              </Badge>
            </div>

            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ project.title }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ formatDate(project.date) }}
              </p>
            </div>

            <p class="text-gray-600 dark:text-gray-300 text-sm">
              {{ project.description }}
            </p>

            <div class="flex flex-wrap gap-1">
              <Badge
                v-for="tech in project.technologies.slice(0, 3)"
                :key="tech"
                variant="secondary"
                class="text-xs"
              >
                {{ tech }}
              </Badge>
              <Badge
                v-if="project.technologies.length > 3"
                variant="secondary"
                class="text-xs"
              >
                +{{ project.technologies.length - 3 }}
              </Badge>
            </div>
          </CardContent>

          <CardFooter>
            <div class="flex gap-2 w-full">
              <Button variant="default" size="sm" class="flex-1" as-child>
                <NuxtLink :to="project.path">View Details</NuxtLink>
              </Button>

              <Button
                v-if="project.github"
                variant="outline"
                size="sm"
                as-child
              >
                <a
                  :href="project.github"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github class="w-4 h-4" />
                </a>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  Loader2,
  AlertTriangle,
  Eye,
  Github,
  Globe,
  LayoutGrid,
  Clock,
} from "lucide-vue-next";

// Meta data
useSeoMeta({
  title: "Projects | CS Portfolio",
  description:
    "Explore my computer science projects including web development, machine learning, and blockchain applications.",
  ogTitle: "Projects | CS Portfolio",
  ogDescription:
    "Explore my computer science projects including web development, machine learning, and blockchain applications.",
  ogType: "website",
});

// Data
const viewMode = ref("timeline");

const {
  data: projects,
  pending,
  error,
} = await useAsyncData("projects", () => queryCollection("projects").all());

console.log(projects.value);

// Methods
const formatDate = (dateString: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return new Date(dateString).toLocaleDateString("en-US", options);
};

const getStatusVariant = (status: string): string => {
  const statusVariants: Record<string, string> = {
    completed: "default",
    "in-progress": "warning",
    planning: "info",
    archived: "secondary",
  };
  return statusVariants[status] || "secondary";
};

const toggleView = () => {
  viewMode.value = viewMode.value === "timeline" ? "grid" : "timeline";
};

const handleImageError = (event: string | Event) => {
  if (typeof event === "string") return;
  const target = event.target as HTMLImageElement;
  // Replace broken images with a placeholder
  target.src =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4=";
  target.classList.add("opacity-50");
};
</script>

<style scoped>
@media (max-width: 768px) {
  /* Mobile responsive adjustments */
  .timeline-item {
    width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .absolute.left-1\/2 {
    left: 1rem !important;
    transform: translateX(0) !important;
  }

  .w-5\/12 {
    width: calc(100% - 3rem) !important;
    margin-left: 3rem !important;
  }
}
</style>
