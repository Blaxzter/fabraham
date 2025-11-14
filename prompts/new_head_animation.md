I wanna create a head animation where it moves to a specific location with specific rotation followed with the head moving from one side of the screen to the other.

Head by the way is the primitive model ref component that loads my head.

I have this #file:ScrollableContent.vue component which i want to fill with more and more cool animations and stuff. And i want the start of the head animation be linked to the start of the component animation.

So i want a content animation where a number of cards scroll from right to left through the view. (All linked to the scroll bar obviously) with a title that comes in with the first element and leaves with the last.
And the head object in the 3d scene should follow the so it come forward and look to the right when the component animation starts and end when the last element left the screen.

Any ideas how to integrate that into the current setup?
I tried to have animation stores for one state control, and composables for complex animations that the state control uses.

Please try to integrate into the existing infastructure as much as possible. I dont think i need a new store for tracking animations.
And investigate
