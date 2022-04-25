def healthy():
    # dictionary with factors of health
    # each health factor is a list with the question, user input, threshold, and two responses
    healthy_vars = {
        "sleep": ["Enter your average daily hours of sleep: ",
                  # threshold value obtained from https://www.webmd.com/sleep-disorders/sleep-requirements
                  0, 8,
                  "Try to get more sleep!",
                  "You are getting a healthy amount of sleep :)"],
        "exercise": ["Enter your average daily minutes of exercise: ",
                     # threshold value obtained from https://www.mayoclinic.org/healthy-lifestyle/fitness/expert
                     # -answers/exercise/faq-20057916
                     0, 30,
                     "Stand up and walk around!",
                     "You are very active :)"],
        "calories": ["Enter your average daily amount of calories: ",
                     # threshold value obtained from https://www.nhs.uk/common-health-questions/food-and-diet/what
                     # -should-my-daily-intake-of-calories-be/
                     0, 2000,
                     "Try to consume some more fats, carbs, and protein!",
                     "You have good eating habits :)"],
        "screentime": ["Enter your average daily hours of screentime: ",
                       # threshold value obtained from https://www.reidhealth.org/blog/screen-time-for-adults
                       0, 11,
                       "You are keeping your eyes healthy :)",
                       "Try to rest your eyes!"]
    }
    # go through all the data values
    for key in healthy_vars.keys():
        # gets the user input value
        healthy_vars[key][1] = int(input(healthy_vars[key][0]))
        # chooses whether the user is healthy or unhealthy by comparing the user input to the threshold value
        if healthy_vars[key][1] < healthy_vars[key][2]:
            print(healthy_vars[key][3])
        else:
            print(healthy_vars[key][4])


# runs the procedure
healthy()
