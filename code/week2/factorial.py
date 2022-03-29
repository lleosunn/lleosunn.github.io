class Factorial:
	def __call__(self, n):
		if n == 0:
			return 1
		elif n == 1:
			return 1
		else:
			return n * self(n-1)

def tester():
    num = int(input("Enter a positive integer: "))
    try:
        fac = Factorial() 
        print("Answer:", fac(num))   
    except:
        print("Sorry, something went wrong.")   

if __name__ == "__main__":
    tester()