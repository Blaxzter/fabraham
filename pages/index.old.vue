<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Hero Section -->
    <div
      class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="container mx-auto px-4 py-16">
        <div class="text-center">
          <h1
            class="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Computer Science Portfolio
          </h1>
          <p
            class="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto"
          >
            Welcome to my CS portfolio. Explore my journey through various
            computer science projects, from web applications and machine
            learning models to blockchain solutions.
          </p>

          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <Button as-child size="lg">
              <NuxtLink to="/projects">
                <Code class="mr-2 h-4 w-4" />
                View Projects
              </NuxtLink>
            </Button>

            <Button variant="outline" size="lg" as-child>
              <a href="#about">
                <User class="mr-2 h-4 w-4" />
                About Me
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Featured Projects Section -->
    <div class="container mx-auto px-4 py-16">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Featured Projects
        </h2>
        <p class="text-lg text-gray-600 dark:text-gray-400">
          A selection of my most notable computer science projects
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Card
          v-for="project in featuredProjects"
          :key="project._path"
          class="hover:shadow-lg transition-shadow duration-300"
        >
          <CardHeader class="p-0">
            <div
              class="aspect-video bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center rounded-t-lg"
            >
              <component
                :is="getProjectIcon(project.technologies[0])"
                class="h-12 w-12 text-white"
              />
            </div>
          </CardHeader>

          <CardContent class="space-y-3">
            <div class="flex items-center gap-2">
              <Badge variant="default"> Featured </Badge>
              <Badge :variant="getStatusVariant(project.status)">
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
              >
                {{ tech }}
              </Badge>
              <Badge v-if="project.technologies.length > 3" variant="secondary">
                +{{ project.technologies.length - 3 }}
              </Badge>
            </div>
          </CardContent>

          <CardFooter class="flex gap-2">
            <Button as-child class="flex-1" size="sm">
              <NuxtLink :to="`/projects/${project.slug}`">
                View Details
              </NuxtLink>
            </Button>

            <Button v-if="project.github" variant="outline" size="sm" as-child>
              <a
                :href="project.github"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github class="h-4 w-4" />
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div class="text-center mt-12">
        <Button variant="outline" size="lg" as-child>
          <NuxtLink to="/projects">
            View All Projects
            <ArrowRight class="ml-2 h-4 w-4" />
          </NuxtLink>
        </Button>
      </div>
    </div>

    <!-- About Section -->
    <div
      id="about"
      class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
    >
      <div class="container mx-auto px-4 py-16">
        <div class="max-w-4xl mx-auto text-center">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            About Me
          </h2>
          <p
            class="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed"
          >
            I'm a passionate computer science student with a focus on full-stack
            development, machine learning, and emerging technologies. My
            projects showcase a diverse range of skills from web development
            using modern frameworks to implementing complex algorithms and
            blockchain solutions.
          </p>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div class="text-center">
              <div
                class="text-2xl font-bold text-primary-600 dark:text-primary-400"
              >
                5+
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Projects Completed
              </div>
            </div>
            <div class="text-center">
              <div
                class="text-2xl font-bold text-primary-600 dark:text-primary-400"
              >
                10+
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Technologies Used
              </div>
            </div>
            <div class="text-center">
              <div
                class="text-2xl font-bold text-primary-600 dark:text-primary-400"
              >
                2+
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Years Experience
              </div>
            </div>
            <div class="text-center">
              <div
                class="text-2xl font-bold text-primary-600 dark:text-primary-400"
              >
                100%
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Passion
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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Code,
  User,
  Github,
  ArrowRight,
  Code2,
  Zap,
  Database,
  Coins,
  Server,
  FileCode,
  Braces,
} from "lucide-vue-next";

// Meta data
useSeoMeta({
  title: "CS Portfolio | Computer Science Projects",
  description:
    "Explore my computer science portfolio featuring web development, machine learning, and blockchain projects.",
  ogTitle: "CS Portfolio | Computer Science Projects",
  ogDescription:
    "Explore my computer science portfolio featuring web development, machine learning, and blockchain projects.",
  ogType: "website",
});

// Fetch featured projects
const { data: allProjects } = await useAsyncData("featured-projects", () =>
  queryContent("/projects").where({ featured: true }).sort({ date: -1 }).find()
);

// Add slug property to each project
const featuredProjects =
  allProjects.value?.map((project) => ({
    ...project,
    slug: project._path.split("/").pop(),
  })) || [];

// Methods
const formatDate = (dateString) => {
  const options = { year: "numeric", month: "long" };
  return new Date(dateString).toLocaleDateString("en-US", options);
};

const getStatusVariant = (status) => {
  const statusVariants = {
    completed: "default",
    "in-progress": "secondary",
    planning: "outline",
    archived: "secondary",
  };
  return statusVariants[status] || "secondary";
};

const getProjectIcon = (technology) => {
  const iconMap = {
    "Vue.js": Code2,
    React: Zap,
    Python: Database,
    Solidity: Coins,
    "Node.js": Server,
    TypeScript: FileCode,
    JavaScript: Braces,
  };
  return iconMap[technology] || Code;
};
</script>
