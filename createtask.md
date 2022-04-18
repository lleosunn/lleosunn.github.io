{% include navigation.html %}

[RUNTIME](https://www.loom.com/share/3fc72f1ebe1d4ce68719f13eddac9b34)

# Create Task Idea:
## Requirements:
* Input and an Output
* At least one list
* At least one procedure
* At least one algorithm

## Idea:
### health reporter
Using Javascript

#### Overview on Idea:
Calculates daily activities (can include the amount of time you watched movies) and notifies if you should take a break from the internet and go outside.

Input: user reports hours of sleep, hours of exercise, calorie intake, etc

Output: tells if the user is healthy. if unhealthy, tell the user how they can improve

List: values that the user inputs will be stored in a list

Procedure: if sleep < 8, and or if hours of exercise < 1, and or if calorie intake 2000, display unhealthy and give user suggestions about how to improve

Sequencing: First code asks for user input, then based on the information it receives it gives a specific output

Selection: If user inputs meet requirements, then they are labeled as 'healthy'

Iteration: repeats through questions until all questions are answered
PBL feature: we can also include aspects relating to screen time and time-watching movies. If the user inputs a large screentime amount, we will tell them to take a break and rest their eyes


# Create Task Responses:
## 3a)
### i. Describes the overall purpose of the program
The overall purpose of the program was to create an application that can help people stay healthy.

### ii. Describes what functionality of the program is demonstrated in the video
The program decides if a user's habits are healthy or not based on the hours of sleep, minutes of exercise, amount of calories, and hours of screentime a user gets.

### iii. Describes the input and output of the program demonstrated in the video
Input:
user inputs hours of sleep, minutes of exercise, amount of calories, and hours of screentime.
Output:
if hours of sleep < 8, tell the user to sleep more
if minutes of exercise < 30, tell the user to exercise more
if calories < 2000, tell the user to eat more
if screentime > 12, tell the user to stop looking at a screen

## 3b)
### i. The first program code segment must show how data have been stored in the list. 
````
list[sleep, exercise, calories, screentime]
````

### ii. The second program code segment must show the data in the same list being used, such as creating new data from the existing data or accessing multiple elements in the list, as part of fulfilling the program’s purpose. 
````
sleep = input('enter your hours of sleep: ')
exercise = input('enter your minutes of exercise: ')
calories = input('enter your amount of calories: ')
screentime = input('enter your hours of screentime: ')
````

### iii. Identifies the name of the list being used in this response
list

### iv. Describes what the data contained in the list represent in your program
strings which are then turned into integers

### v. Explains how the selected list manages complexity in your program code by explaining why your program code could not be written, or how it would be written differently if you did not use the list 
If I wrote it without the list, I would have to make the function take in all 4 values instead of just the list.

## 3c)
### i. The first program code segment must be a student-developed procedure that: 
* Defines the procedure’s name and return type (if necessary)
* Contains and uses one or more parameters that have an effect on the functionality of the procedure
* Implements an algorithm that includes sequencing, selection, and iteration

````
def healthy(list):
    list[sleep, exercise, calories, screentime]
    if int(sleep) < 8:
        print("get some more sleep!")
    else:
        print("you are getting enough sleep :)")
    if int(exercise) < 30:
        print("stand up and go for a walk!")
    else:
        print("you are very active :)")
    if int(calories) < 2000:
        print("consume some more fats, carbs, protein!")
    else:
        print("you have good eating habits :)")
    if int(screentime) > 12:
        print("rest your eyes!")
    else:
        print("you are keeping your eyes healthy :)")
````

### ii. The second program code segment must show where your student-developed procedure is being called in your program.
````
healthy(list)
````

### iii. Describes in general what the identified procedure does and how it contributes to the overall functionality of the program
It takes in different variables inputted by the user and decides whether the user is healthy or not based on certain parameters.

### iv. Explains in detailed steps how the algorithm implemented in the identified procedure works. Your explanation must be detailed enough for someone else to recreate it.
The algorithm has set values that were researched on google. These values were the baseline of whether someone was declared healthy or unhealthy. Then some pre-typed messages are displayed based on the input value and its relation with the parameters.

## 3d)
### i. Describes two calls to the procedure identified in written response 3c. Each call must pass a different argument(s) that causes a different segment of code in the algorithm to execute.
First call: 
````
if int(sleep) < 8:
        print("get some more sleep!")
````

Second call:
````
else:
        print("you are getting enough sleep :)")
````

### ii. Describes what condition(s) is being tested by each call to the procedure
Condition(s) tested by the first call:

The first call tests if the amount of sleep is less than 8.

Condition(s) tested by the second call

The second call tests if the amount of sleep is not less than 8.

### iii. Identifies the result of each call
Result of the first call:
The first call will result in the program displaying "get some more sleep!"

Result of the second call:
The second call will result in the program displaying "you are getting enough sleep :)"
