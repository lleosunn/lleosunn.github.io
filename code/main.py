from week1.fibonacci import fib
from week1.infodb import *
from week2.factorial import *
from week2.average import *
from week3.password import *



main_menu = [
	["Info DB", "code/week1/infodb.py"],
	["Password Generator", "code/week3/password.py"],

]

# Submenu list of [Prompt, Action]
# Works similarly to main_menu
sub_menu = [
  ["ship", "patterns/ship.py"],
	["blowfish", "patterns/blowfish.py"],
	["tree", "patterns/tree.py"],
]


math_sub_menu = [
	["Matrix", "code/week0/matrix.py"],
	["Swap", "code/week0/swap.py"],
	["Fibonacci Sequence", "code/week1/fibonacci.py"],
	["Factorial", "code/week2/factorial.py"],
	["Average", "code/week2/average.py"]
]


# Menu banner is typically defined by menu owner
border = "=" * 25
banner = f"\n{border}\nPlease Select An Option\n{border}"

# def menu
# using main_menu list:
# 1. main menu and submenu reference are created [Prompts, Actions]
# 2. menu_list is sent as parameter to menuy.menu function that has logic for menu control
def menu():
	title = "Function Menu" + banner
	menu_list = main_menu.copy()
	menu_list.append(["Patterns", submenu])
	menu_list.append(["Math", math_submenu])
	buildMenu(title, menu_list)

# def submenu
# using sub menu list above:
# sub_menu works similarly to menu()
def submenuc():
  title = "Class Submenu" + banner
  m = submenus.Menu(title, sub_menu)
  m.menu()

def submenu():
    title = "Function Submenu" + banner
    buildMenu(title, sub_menu)

def math_submenuc():
    title = "submenu" + banner
    m = submenus.Menu(title, math_sub_menu)
    m.menu()


def math_submenu():
    title = "submenu" + banner
    buildMenu(title, math_sub_menu)


	
# builds console menu
def buildMenu(banner, options):
    print(banner)
    prompts = {0: ["Exit", None]}
    for op in options:
        index = len(prompts)
        prompts[index] = op

    # print menu
    for key, value in prompts.items():
        print(key, '->', value[0])

    # get user input
    choice = input("Type your choice> ")

    # Process user input
    try:
        choice = int(choice)
        if choice == 0:
            # stops
            return
        try:
            action = prompts.get(choice)[1]
            action()
        except TypeError:
            try:
                exec(open(action).read())
            except FileNotFoundError:
                # check main_menu dictionary
                print(f"File not found!: {action}")
    except ValueError:
        # not a number 
        print(f"Not a number: {choice}")
    except UnboundLocalError:
        # not one of the numbers listed
        print(f"Invalid choice: {choice}")
  

    buildMenu(banner, options)  # recursion, start menu over again


if __name__ == "__main__":
    menu()