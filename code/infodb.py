InfoDb = []
# List with dictionary records placed in a list  
InfoDb.append({  
	"FirstName": "LeBron",  
    "LastName": "James",  
	"Played_For":["Cavs","Lakers","Heat"]  
})  

InfoDb.append({  
	"FirstName": "Stephen",  
	"LastName": "Curry",  
	"Owns_Cars":["Warriors"]  
})  

InfoDb.append({  
	"FirstName": "Dwyane",  
	"LastName": "Wade",  
	"Played_For":["Heat", "Cavs", "Bulls"]  
})

def for_loop():
	for i in range(len(InfoDb)):
		print(InfoDb[i])

def while_loop():
	i = 0
	while i < len(InfoDb):
		print(InfoDb[i])
		i = i+1

def recursive_loop(i = 0):
	if i < len(InfoDb):
		print(InfoDb[i])
		recursive_loop(i + 1)

def tester():
	num = int(input("Pick a number for a loop? 1=while, 2=for, 3=recursive"))
	print(num)
	print(type(num))
	if num == 1:
		while_loop()
	elif num == 2:
		for_loop()
	elif num == 3:
		recursive_loop()
	
if __name__ == "__main__":
   # stuff only to run when not called via 'import' here
   tester()