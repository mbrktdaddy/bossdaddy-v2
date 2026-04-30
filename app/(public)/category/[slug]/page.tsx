import { redirect } from 'next/navigation'

interface Props {
 params: Promise<{ slug: string }>
}

export default async function CategoryPage({ params }: Props) {
 const { slug } = await params
 redirect(`/reviews?category=${slug}`)
}
