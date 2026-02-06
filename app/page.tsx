import { redirect } from "next/navigation";

function Home() {

  redirect("/login");


  return null
}

export default Home
