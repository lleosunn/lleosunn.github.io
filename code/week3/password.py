import random
import string

all = list(string.ascii_letters + string.digits + "!@#$%^&*()")


def gen():
	passw = int(input("Enter password length: "))
	random.shuffle(all)
	password = []
	for i in range(passw):
		password.append(random.choice(all))
	
	random.shuffle(password)
	
	print("".join(password))

gen()