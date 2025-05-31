<template>
  <Button
    variant="ghost"
    size="icon"
    class="relative"
    :title="
      colorMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
    "
    @click="toggleColorMode"
  >
    <Sun
      class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
    />
    <Moon
      class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
    />
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-vue-next";

const { colorMode, toggleColorMode } = useTheme();
</script>
